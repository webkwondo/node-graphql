import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  graphql,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString
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
