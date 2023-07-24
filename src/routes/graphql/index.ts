import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  graphql,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  Kind,
  parse,
  validate
} from 'graphql';
import { User } from "@prisma/client";
import { UUIDType } from './types/uuid.js';
import { MemberTypeId } from '../member-types/schemas.js';
import depthLimit from 'graphql-depth-limit';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  const MemberTypeIdEnum = new GraphQLEnumType({
    name: 'MemberTypeId',
    values: {
      [MemberTypeId.BASIC]: { value: MemberTypeId.BASIC },
      [MemberTypeId.BUSINESS]: { value: MemberTypeId.BUSINESS },
    },
  });

  const MemberType = new GraphQLObjectType({
    name: 'MemberType',
    fields: () => ({
      id: { type: MemberTypeIdEnum },
      discount: { type: GraphQLFloat },
      postsLimitPerMonth: { type: GraphQLInt },
      profiles: { type: new GraphQLList(Profile) },
    }),
  });

  const Post = new GraphQLObjectType({
    name: 'Post',
    fields: () => ({
      id: { type: UUIDType },
      title: { type: GraphQLString },
      content: { type: GraphQLString },
      author: { type: User },
    }),
  });

  const User = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
      id: { type: UUIDType },
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
      profile: { type: Profile },
      posts: { type: new GraphQLList(Post) },
      userSubscribedTo: {
        type: new GraphQLList(User),
        resolve: async (source: User, _, { prisma }) => {
          return await prisma.user.findMany({
            where: {
              subscribedToUser: {
                some: {
                  subscriberId: source.id,
                },
              },
            },
          });
        },
      },
      subscribedToUser: {
        type: new GraphQLList(User),
        resolve: async (source: User, _, { prisma }) => {
          return await prisma.user.findMany({
            where: {
              userSubscribedTo: {
                some: {
                  authorId: source.id,
                },
              },
            },
          });
        },
      },
    }),
  });

  const Profile = new GraphQLObjectType({
    name: 'Profile',
    fields: () => ({
      id: { type: UUIDType },
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      user: { type: User },
      memberType: { type: MemberType },
    }),
  });

  const CreatePostInput = new GraphQLInputObjectType({
    name: 'CreatePostInput',
    fields: () => ({
      title: { type: GraphQLString },
      content: { type: GraphQLString },
      authorId: { type: UUIDType },
    }),
  });

  const CreateUserInput = new GraphQLInputObjectType({
    name: 'CreateUserInput',
    fields: () => ({
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
    }),
  });

  const CreateProfileInput = new GraphQLInputObjectType({
    name: 'CreateProfileInput',
    fields: () => ({
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      memberTypeId: { type: MemberTypeIdEnum },
      userId: { type: UUIDType },
    }),
  });

  const EmptyResponse = new GraphQLScalarType({
    name: 'EmptyResponse',
    description: 'Represents an empty response in GraphQL.',
    serialize(value) {
      return null;
    },
    parseValue(value) {
      return null;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.NULL) {
        // If the literal is NULL, return null
        return null;
      }
      throw new Error('Invalid EmptyResponse scalar literal. Must be NULL.');
    },
  });

  const ChangePostInput = new GraphQLInputObjectType({
    name: 'ChangePostInput',
    fields: () => ({
      title: { type: GraphQLString },
      content: { type: GraphQLString },
    }),
  });

  const ChangeProfileInput = new GraphQLInputObjectType({
    name: 'ChangeProfileInput',
    fields: () => ({
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      memberTypeId: { type: MemberTypeIdEnum },
    }),
  });

  const ChangeUserInput = new GraphQLInputObjectType({
    name: 'ChangeUserInput',
    fields: () => ({
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
    }),
  });

  const resolvers = {
    Query: {
      memberTypes: async () => {
        return prisma.memberType.findMany();
      },
      posts: async () => {
        return prisma.post.findMany();
      },
      users: async () => {
        return prisma.user.findMany({
          include: {
            profile: {
              include: {
                memberType: true,
              },
            },
            posts: true,
          },
        });
      },
      profiles: async () => {
        return prisma.profile.findMany();
      },
      memberType: async (_, { id }) => {
        return prisma.memberType.findUnique({
          where: { id },
        });
      },
      post: async (_, { id }) => {
        return prisma.post.findUnique({
          where: { id },
        });
      },
      user: async (_, { id }) => {
        return await prisma.user.findUnique({
          where: { id },
          include: {
            profile: {
              include: {
                memberType: true,
              },
            },
            posts: true,
            userSubscribedTo: true,
            subscribedToUser: true,
          },
        });
      },
      profile: async (_, { id }) => {
        return prisma.profile.findUnique({
          where: { id },
        });
      },
    },
    Mutation: {
      createPost: async (_, { dto }, { prisma }) => {
        const newPost = await prisma.post.create({
          data: { ...dto },
        });

        return newPost;
      },
      createUser: async (_, { dto }, { prisma }) => {
        const newUser = await prisma.user.create({
          data: { ...dto },
        });

        return newUser;
      },
      createProfile: async (_, { dto }, { prisma }) => {
        const newProfile = await prisma.profile.create({
          data: { ...dto },
        });

        return newProfile;
      },
      deletePost: async (_, { id }, { prisma }) => {
        await prisma.post.delete({
          where: { id },
        });

        return null;
      },
      deleteUser: async (_, { id }, { prisma }) => {
        await prisma.user.delete({
          where: { id },
        });

        return null;
      },
      deleteProfile: async (_, { id }, { prisma }) => {
        await prisma.profile.delete({
          where: { id },
        });

        return null;
      },
      changePost: async (_, { id, dto }, { prisma }) => {
        const updatedPost = await prisma.post.update({
          where: { id },
          data: { ...dto },
        });

        return updatedPost;
      },
      changeProfile: async (_, { id, dto }, { prisma }) => {
        const updatedProfile = await prisma.profile.update({
          where: { id },
          data: { ...dto },
        });

        return updatedProfile;
      },
      changeUser: async (_, { id, dto }, { prisma }) => {
        const updatedUser = await prisma.user.update({
          where: { id },
          data: { ...dto },
        });

        return updatedUser;
      },
      subscribeTo: async (_, { userId, authorId }, { prisma }) => {
        const newSubscription = await prisma.subscribersOnAuthors.create({
          data: {
            subscriber: { connect: { id: userId } },
            author: { connect: { id: authorId } },
          },
        });

        return newSubscription;
      },
      unsubscribeFrom: async (_, { userId, authorId }, { prisma }) => {
        await prisma.subscribersOnAuthors.delete({
          where: { subscriberId_authorId: { subscriberId: userId, authorId } },
        });

        return null;
      },
    },
  };

  const executableSchema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        memberTypes: {
          type: new GraphQLList(MemberType),
          resolve: resolvers.Query.memberTypes,
        },
        posts: {
          type: new GraphQLList(Post),
          resolve: resolvers.Query.posts,
        },
        users: {
          type: new GraphQLList(User),
          resolve: resolvers.Query.users,
        },
        profiles: {
          type: new GraphQLList(Profile),
          resolve: resolvers.Query.profiles,
        },
        memberType: {
          type: MemberType,
          args: {
            id: { type: MemberTypeIdEnum },
          },
          resolve: resolvers.Query.memberType,
        },
        post: {
          type: Post,
          args: {
            id: { type: UUIDType },
          },
          resolve: resolvers.Query.post,
        },
        user: {
          type: User,
          args: {
            id: { type: UUIDType },
          },
          resolve: resolvers.Query.user,
        },
        profile: {
          type: Profile,
          args: {
            id: { type: UUIDType },
          },
          resolve: resolvers.Query.profile,
        },
      },
    }),
    mutation: new GraphQLObjectType({
      name: 'Mutation',
      fields: {
        createPost: {
          type: Post,
          args: {
            dto: { type: CreatePostInput },
          },
          resolve: resolvers.Mutation.createPost,
        },
        createUser: {
          type: User,
          args: {
            dto: { type: CreateUserInput },
          },
          resolve: resolvers.Mutation.createUser,
        },
        createProfile: {
          type: Profile,
          args: {
            dto: { type: CreateProfileInput },
          },
          resolve: resolvers.Mutation.createProfile,
        },
        deletePost: {
          type: EmptyResponse,
          args: {
            id: { type: UUIDType },
          },
          resolve: resolvers.Mutation.deletePost,
        },
        deleteUser: {
          type: EmptyResponse,
          args: {
            id: { type: UUIDType },
          },
          resolve: resolvers.Mutation.deleteUser,
        },
        deleteProfile: {
          type: EmptyResponse,
          args: {
            id: { type: UUIDType },
          },
          resolve: resolvers.Mutation.deleteProfile,
        },
        changePost: {
          type: Post,
          args: {
            id: { type: UUIDType },
            dto: { type: ChangePostInput },
          },
          resolve: resolvers.Mutation.changePost,
        },
        changeProfile: {
          type: Profile,
          args: {
            id: { type: UUIDType },
            dto: { type: ChangeProfileInput },
          },
          resolve: resolvers.Mutation.changeProfile,
        },
        changeUser: {
          type: User,
          args: {
            id: { type: UUIDType },
            dto: { type: ChangeUserInput },
          },
          resolve: resolvers.Mutation.changeUser,
        },
        subscribeTo: {
          type: User,
          args: {
            userId: { type: UUIDType },
            authorId: { type: UUIDType },
          },
          resolve: resolvers.Mutation.subscribeTo,
        },
        unsubscribeFrom: {
          type: EmptyResponse,
          args: {
            userId: { type: UUIDType },
            authorId: { type: UUIDType },
          },
          resolve: resolvers.Mutation.unsubscribeFrom,
        },
      },
    }),
  });

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    preHandler: async (req, reply) => {
      const { query } = req.body;
      const errors = validate(executableSchema, parse(query), [depthLimit(5)]);

      if (errors.length > 0) {
        await reply.send({
          errors: errors.map((error) => ({ message: error.message })),
        });
      }
    },
    async handler(req) {
      const { query, variables } = req.body;

      try {
        const result = await graphql({
          schema: executableSchema,
          source: query,
          contextValue: { prisma },
          variableValues: variables,
        });

        return result;
      } catch (error) {
        return {
          errors: [
            {
              message: error instanceof Error ?
                error.message :
                'Invalid operation or query not handled.'
            }
          ],
        };
      }
    },
  });
};

export default plugin;
