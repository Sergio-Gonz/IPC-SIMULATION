const Joi = require('joi');
const config = require('../config/config');

const authSchema = Joi.object({
  role: Joi.string()
    .valid(...Object.keys(config.PERMISSIONS))
    .required()
    .messages({
      'any.required': 'El rol es requerido',
      'any.only': 'Rol no válido',
    }),
  token: Joi.string().required().messages({
    'any.required': 'El token es requerido',
  }),
});

const actionSchema = Joi.object({
  type: Joi.string()
    .valid(...config.PROCESS_TYPES)
    .required()
    .messages({
      'any.required': 'El tipo de acción es requerido',
      'any.only': 'Tipo de acción no válido',
    }),
  processType: Joi.string()
    .valid(...Object.values(config.PROCESS_TYPES))
    .required()
    .messages({
      'any.required': 'El tipo de proceso es requerido',
      'any.only': 'Tipo de proceso no válido',
    }),
  priority: Joi.number().min(1).max(5).required().messages({
    'number.min': 'La prioridad debe ser al menos 1',
    'number.max': 'La prioridad no puede ser mayor a 5',
    'any.required': 'La prioridad es requerida',
  }),
  data: Joi.object().required().messages({
    'any.required': 'Los datos son requeridos',
  }),
});

module.exports = {
  authSchema,
  actionSchema,
};
