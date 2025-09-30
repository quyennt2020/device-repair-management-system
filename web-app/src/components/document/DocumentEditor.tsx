import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useDropzone } from 'react-dropzone';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardMedia,
  CardActions,
  Chip,
  LinearProgress,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  CloudUpload,
  Image,
  AttachFile,
  Delete,
  Edit,
  Save,
  Cancel,
  Crop as CropIcon,
  Download,
  Visibility,
  Add,
} from '@mui/icons-material';

interface DocumentTemplate {
  id: string;
  name: string;
  fields: TemplateField[];
  content: string;
}

interface TemplateField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiline' | 'file' | 'image';
  required: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface DocumentAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
}

interface DocumentContent {
  richText: string;
  fields: Record<string, any>;
  attachments: DocumentAttachment[];
}

interface DocumentEditorProps {
  template?: DocumentTemplate;
  initialContent?: DocumentContent;
  onSave: (content: DocumentContent) => Promise<void>;
  onCancel?: () => void;
  readOnly?: boolean;
  autoSave?: boolean;
  autoSaveInterval?: number;
}

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }],
    ['link', 'image'],
    ['clean']
  ],
};

const quillFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'bullet', 'indent',
  'link', 'image'
];

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  template,
  initialContent,
  onSave,
  onCancel,
  readOnly = false,
  autoSave = false,
  autoSaveInterval = 30000,
}) => {
  const [content, setContent] = useState<DocumentContent>(
    initialContent || {
      richText: '',
      fields: {},
      attachments: [],
    }
  );
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && !readOnly) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSave(true);
      }, autoSaveInterval);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [content, autoSave, autoSaveInterval]);

  const handleRichTextChange = (value: string) => {
    setContent(prev => ({ ...prev, richText: value }));
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setContent(prev => ({
      ...prev,
      fields: { ...prev.fields, [fieldId]: value }
    }));
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const fileId = `upload-${Date.now()}-${Math.random()}`;
      setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

      // Simulate file upload with progress
      const uploadSimulation = setInterval(() => {
        setUploadProgress(prev => {
          const currentProgress = prev[fileId] || 0;
          if (currentProgress >= 100) {
            clearInterval(uploadSimulation);
            
            // Add to attachments
            const newAttachment: DocumentAttachment = {
              id: fileId,
              name: file.name,
              type: file.type,
              size: file.size,
              url: URL.createObjectURL(file),
              uploadedAt: new Date(),
            };

            if (file.type.startsWith('image/')) {
              newAttachment.thumbnailUrl = newAttachment.url;
            }

            setContent(prev => ({
              ...prev,
              attachments: [...prev.attachments, newAttachment]
            }));

            // Remove from progress tracking
            setUploadProgress(prev => {
              const { [fileId]: removed, ...rest } = prev;
              return rest;
            });

            return prev;
          }
          return { ...prev, [fileId]: currentProgress + 10 };
        });
      }, 200);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: readOnly,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  });

  const handleRemoveAttachment = (attachmentId: string) => {
    setContent(prev => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== attachmentId)
    }));
  };

  const handleCropImage = (attachment: DocumentAttachment) => {
    setCropImage(attachment.url);
    setCropDialogOpen(true);
  };

  const handleCropComplete = useCallback(() => {
    if (!completedCrop || !previewCanvasRef.current || !imgRef.current) {
      return;
    }

    const canvas = previewCanvasRef.current;
    const image = imgRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    // Convert canvas to blob and update attachment
    canvas.toBlob((blob) => {
      if (blob) {
        const croppedUrl = URL.createObjectURL(blob);
        setContent(prev => ({
          ...prev,
          attachments: prev.attachments.map(att =>
            att.url === cropImage ? { ...att, url: croppedUrl, thumbnailUrl: croppedUrl } : att
          )
        }));
      }
    });

    setCropDialogOpen(false);
    setCropImage(null);
  }, [completedCrop, cropImage]);

  const handleSave = async (isAutoSave = false) => {
    if (readOnly) return;
    
    setSaving(true);
    try {
      await onSave(content);
      if (!isAutoSave) {
        // Show success message for manual saves
      }
    } catch (error) {
      console.error('Failed to save document:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderTemplateField = (field: TemplateField) => {
    const value = content.fields[field.id] || '';

    switch (field.type) {
      case 'text':
        return (
          <TextField
            fullWidth
            label={field.name}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            disabled={readOnly}
            variant="outlined"
            size="small"
          />
        );

      case 'multiline':
        return (
          <TextField
            fullWidth
            multiline
            rows={4}
            label={field.name}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            disabled={readOnly}
            variant="outlined"
          />
        );

      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={field.name}
            value={value}
            onChange={(e) => handleFieldChange(field.id, parseFloat(e.target.value))}
            required={field.required}
            disabled={readOnly}
            variant="outlined"
            size="small"
            inputProps={{
              min: field.validation?.min,
              max: field.validation?.max,
            }}
          />
        );

      case 'date':
        return (
          <TextField
            fullWidth
            type="date"
            label={field.name}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            disabled={readOnly}
            variant="outlined"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        );

      case 'select':
        return (
          <FormControl fullWidth size="small">
            <InputLabel>{field.name}</InputLabel>
            <Select
              value={value}
              label={field.name}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              required={field.required}
              disabled={readOnly}
            >
              {field.options?.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Template Fields */}
      {template && template.fields.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" mb={2}>Document Fields</Typography>
          <Grid container spacing={2}>
            {template.fields.map((field) => (
              <Grid item xs={12} sm={6} md={4} key={field.id}>
                {renderTemplateField(field)}
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Rich Text Editor */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Content</Typography>
        </Box>
        <Box sx={{ minHeight: 300 }}>
          <ReactQuill
            theme="snow"
            value={content.richText}
            onChange={handleRichTextChange}
            modules={quillModules}
            formats={quillFormats}
            readOnly={readOnly}
            style={{ height: '250px' }}
          />
        </Box>
      </Paper>

      {/* File Upload Area */}
      {!readOnly && (
        <Paper sx={{ mb: 2 }}>
          <Box
            {...getRootProps()}
            sx={{
              p: 3,
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'grey.300',
              borderRadius: 1,
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragActive ? 'action.hover' : 'transparent',
            }}
          >
            <input {...getInputProps()} />
            <CloudUpload sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
            <Typography variant="h6" color="textSecondary">
              {isDragActive ? 'Drop files here' : 'Drag & drop files here, or click to select'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Supports images, PDFs, and documents
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" mb={2}>Uploading...</Typography>
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <Box key={fileId} sx={{ mb: 1 }}>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="caption">{progress}%</Typography>
            </Box>
          ))}
        </Paper>
      )}

      {/* Attachments */}
      {content.attachments.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" mb={2}>Attachments</Typography>
          <Grid container spacing={2}>
            {content.attachments.map((attachment) => (
              <Grid item xs={12} sm={6} md={4} key={attachment.id}>
                <Card>
                  {attachment.type.startsWith('image/') ? (
                    <CardMedia
                      component="img"
                      height="140"
                      image={attachment.thumbnailUrl || attachment.url}
                      alt={attachment.name}
                    />
                  ) : (
                    <Box
                      sx={{
                        height: 140,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'grey.100',
                      }}
                    >
                      <AttachFile sx={{ fontSize: 48, color: 'grey.400' }} />
                    </Box>
                  )}
                  
                  <Box sx={{ p: 1 }}>
                    <Typography variant="body2" noWrap>
                      {attachment.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {(attachment.size / 1024).toFixed(1)} KB
                    </Typography>
                  </Box>
                  
                  {!readOnly && (
                    <CardActions>
                      {attachment.type.startsWith('image/') && (
                        <IconButton
                          size="small"
                          onClick={() => handleCropImage(attachment)}
                        >
                          <CropIcon />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => window.open(attachment.url, '_blank')}
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </CardActions>
                  )}
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Action Buttons */}
      {!readOnly && (
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          {onCancel && (
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={() => handleSave()}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      )}

      {/* Image Crop Dialog */}
      <Dialog
        open={cropDialogOpen}
        onClose={() => setCropDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Crop Image</DialogTitle>
        <DialogContent>
          {cropImage && (
            <Box>
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={undefined}
              >
                <img
                  ref={imgRef}
                  alt="Crop"
                  src={cropImage}
                  style={{ maxWidth: '100%' }}
                />
              </ReactCrop>
              <canvas
                ref={previewCanvasRef}
                style={{ display: 'none' }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCropDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCropComplete} variant="contained">
            Apply Crop
          </Button>
        </DialogActions>
      </Dialog>

      {/* Auto-save indicator */}
      {autoSave && (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16 }}>
          <Chip
            label={saving ? 'Saving...' : 'Auto-save enabled'}
            color={saving ? 'warning' : 'success'}
            size="small"
          />
        </Box>
      )}
    </Box>
  );
};

export default DocumentEditor;

// Export types
export type { DocumentTemplate, DocumentContent, DocumentAttachment };