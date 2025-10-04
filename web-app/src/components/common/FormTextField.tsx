import React from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { Controller, Control, FieldError } from 'react-hook-form';

interface FormTextFieldProps extends Omit<TextFieldProps, 'name' | 'error'> {
  name: string;
  control: Control<any>;
  fieldError?: FieldError;
}

const FormTextField: React.FC<FormTextFieldProps> = ({
  name,
  control,
  fieldError,
  ...textFieldProps
}) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          {...textFieldProps}
          error={!!fieldError}
          helperText={fieldError?.message || textFieldProps.helperText}
        />
      )}
    />
  );
};

export default FormTextField;
