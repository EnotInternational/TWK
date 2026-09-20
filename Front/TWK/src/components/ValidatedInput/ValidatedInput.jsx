import React, { useState, useEffect } from 'react';
import { useToast } from '../Toast/ToastContext';

export default function ValidatedInput({ 
  value, 
  onChange, 
  min = 0, 
  max, 
  name,
  className,
  ...props 
}) {
  const addToast = useToast();
  const [localValue, setLocalValue] = useState(value ?? '');

  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  const handleKeyDown = (e) => {
    if (props.type === 'text') {
      if (props.onKeyDown) props.onKeyDown(e);
      return;
    }
    const blockedKeys = ['e', 'E', '+'];
    if (min >= 0) blockedKeys.push('-');

    if (blockedKeys.includes(e.key)) {
      e.preventDefault();
      addToast(`Символ "${e.key}" запрещён для ввода.`, 'error');
      return;
    }

    if (e.key.length === 1 && /[a-zA-Zа-яА-Я]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      addToast(`Ввод букв запрещён. Пожалуйста, используйте цифры.`, 'error');
      return;
    }
    
    if (props.onKeyDown) props.onKeyDown(e);
  };

  const handleChange = (e) => {
    setLocalValue(e.target.value);
    if (onChange) onChange(e);
  };

  const handleBlur = (e) => {
    if (props.type === 'text') {
      if (props.onBlur) props.onBlur(e);
      return;
    }
    
    let numVal = parseFloat(e.target.value);
    let corrected = false;
    let errorMsg = '';

    if (isNaN(numVal) || e.target.value === '') {
       numVal = min;
       corrected = true;
       errorMsg = 'Пустое или некорректное значение. Сброшено на минимум.';
    } else if (numVal < min) {
      numVal = min;
      corrected = true;
      errorMsg = `Значение не может быть меньше ${min}.`;
    } else if (max !== undefined && numVal > max) {
      numVal = max;
      corrected = true;
      errorMsg = `Значение не может быть больше ${max}.`;
    }

    if (corrected) {
      addToast(errorMsg, 'error');
      const syntheticEvent = {
        target: { name: name, value: numVal.toString() }
      };
      if (onChange) onChange(syntheticEvent);
      setLocalValue(numVal.toString());
    }
    
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  return (
    <input
      type={props.type || "number"}
      name={name}
      className={className}
      value={localValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      min={min}
      max={max}
      {...props}
    />
  );
}
