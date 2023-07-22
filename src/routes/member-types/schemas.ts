import { Type } from '@fastify/type-provider-typebox';

export enum MemberTypeId {
  BASIC = 'basic',
  BUSINESS = 'business',
}

export const memberTypeFields = {
  id: Type.String({
    pattern: Object.values(MemberTypeId).join('|'),
  }),
  discount: Type.Number(),
  postsLimitPerMonth: Type.Integer(),
};

export const memberTypeSchema = Type.Object({
  ...memberTypeFields,
});

export const getMemberTypeByIdSchema = {
  params: Type.Object(
    {
      memberTypeId: memberTypeFields.id,
    },
    {
      additionalProperties: false,
    },
  ),
};
