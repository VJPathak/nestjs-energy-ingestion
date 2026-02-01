import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiCreatedResponse,
  getSchemaPath,
} from '@nestjs/swagger';

export const ApiSuccessResponse = <TModel extends Type<any>>(
  model: TModel,
  isArray = false,
) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: isArray
            ? { type: 'array', items: { $ref: getSchemaPath(model) } }
            : { $ref: getSchemaPath(model) },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', example: '2025-01-31T10:00:00Z' },
              requestId: { type: 'string', example: 'req-12345' },
            },
          },
        },
      },
    }),
  );
};

export const ApiCreatedSuccessResponse = <TModel extends Type<any>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiCreatedResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: getSchemaPath(model) },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', example: '2025-01-31T10:00:00Z' },
            },
          },
        },
      },
    }),
  );
};
