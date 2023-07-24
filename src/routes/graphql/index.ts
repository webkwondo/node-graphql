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
  Kind
} from 'graphql';
import { UUIDType } from './types/uuid.js';
import { MemberTypeId } from '../member-types/schemas.js';

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
        type: new GraphQLList(SubscribersOnAuthors),
      },
      subscribedToUser: {
        type: new GraphQLList(SubscribersOnAuthors),
      },
    }),
  });

  const SubscribersOnAuthors = new GraphQLObjectType({
    name: 'SubscribersOnAuthors',
    fields: () => ({
      id: { type: UUIDType },
      subscriber: {
        type: User,
      },
      author: {
        type: User,
      },
      userSubscribedTo: {
        type: new GraphQLList(SubscribersOnAuthors),
      },
      subscribedToUser: {
        type: new GraphQLList(SubscribersOnAuthors),
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
        const entry = await prisma.user.findUnique({
          where: { id },
          include: {
            profile: {
              include: {
                memberType: true,
              },
            },
            posts: true,
            userSubscribedTo: {
              include: {
                author: {
                  include: {
                    subscribedToUser: {
                      include: {
                        subscriber: true
                      }
                    }
                  }
                }
              }
            },
            subscribedToUser: {
              include: {
                subscriber: {
                  include: {
                    userSubscribedTo: {
                      include: {
                        author: true
                      }
                    }
                  }
                }
              }
            },
          },
        });

        const transformedEntry = {
          ...entry,
          userSubscribedTo: entry?.userSubscribedTo.map((item) => ({
            id: item.author.id,
            subscribedToUser: item.author.subscribedToUser.map((it) => ({
              id: it.subscriber.id
            }))
          })),
          subscribedToUser: entry?.subscribedToUser.map((item) => ({
            id: item.subscriber.id,
            userSubscribedTo: item.subscriber.userSubscribedTo.map((it) => ({
              id: it.author.id
            }))
          })),
        };

        return entry ? transformedEntry : entry;
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
          data: dto,
        });

        return newPost;
      },
      createUser: async (_, { dto }, { prisma }) => {
        const newUser = await prisma.user.create({
          data: dto,
        });

        return newUser;
      },
      createProfile: async (_, { dto }, { prisma }) => {
        const newProfile = await prisma.profile.create({
          data: dto,
        });

        return newProfile;
      },
      deletePost: async (_, { id }, { prisma }) => {
        const deletedPost = await prisma.post.delete({
          where: { id },
        });

        return null;
        // return deletedPost;
      },
      deleteUser: async (_, { id }, { prisma }) => {
        const deletedUser = await prisma.user.delete({
          where: { id },
        });

        return null;
        // return deletedUser;
      },
      deleteProfile: async (_, { id }, { prisma }) => {
        const deletedProfile = await prisma.profile.delete({
          where: { id },
        });

        return null;
        // return deletedProfile;
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
          // type: Post,
          args: {
            id: { type: UUIDType },
          },
          resolve: resolvers.Mutation.deletePost,
        },
        deleteUser: {
          type: EmptyResponse,
          // type: User,
          args: {
            id: { type: UUIDType },
          },
          resolve: resolvers.Mutation.deleteUser,
        },
        deleteProfile: {
          type: EmptyResponse,
          // type: Profile,
          args: {
            id: { type: UUIDType },
          },
          resolve: resolvers.Mutation.deleteProfile,
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
