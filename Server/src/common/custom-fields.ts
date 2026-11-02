import {
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'customFields', async: false })
export class CustomFieldsValidator implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const entries = Object.entries(value);
    return (
      entries.length <= 20 &&
      entries.every(
        ([key, item]) =>
          key.trim().length > 0 &&
          key.length <= 60 &&
          !['__proto__', 'constructor', 'prototype'].includes(key) &&
          typeof item === 'string' &&
          item.length <= 500,
      )
    );
  }
  defaultMessage() {
    return 'Use up to 20 custom fields with names up to 60 characters and text values up to 500 characters.';
  }
}
