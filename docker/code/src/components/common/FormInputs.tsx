import React from 'react';

export interface FormInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  onChange: (value: string) => void;
  helpText?: string;
}

/**
 * 通用表单输入框组件
 * 支持验证、错误提示、帮助文本
 */
export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, helpText, onChange, className = '', ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-sm font-semibold text-gray-900 mb-2">{label}</label>
        )}
        <input
          ref={ref}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-2 border ${
            error ? 'border-red-300' : 'border-gray-300'
          } rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

export interface FormSelectOption {
  label: string;
  value: string | number;
}

interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  options: FormSelectOption[];
  onChange: (value: string) => void;
  helpText?: string;
  placeholder?: string;
}

/**
 * 通用表单下拉框组件
 * 支持验证、错误提示、帮助文本
 */
export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  (
    { label, error, options, helpText, onChange, placeholder, className = '', ...props },
    ref
  ) => {
    return (
      <div>
        {label && (
          <label className="block text-sm font-semibold text-gray-900 mb-2">{label}</label>
        )}
        <select
          ref={ref}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-2 border ${
            error ? 'border-red-300' : 'border-gray-300'
          } rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={`${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
      </div>
    );
  }
);

FormSelect.displayName = 'FormSelect';
