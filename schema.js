const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GraphQLError } = require('graphql');

const db = require('./config/db');
const unsplashService = require('./services/unsplash');
const pixabayService = require('./services/pixabay');
const storyblocksService = require('./services/storyblocks');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_static_secret_key';

const typeDefs = `#graphql
    type AuthPayload {
        message: String!
        token: String
    }

    type ImageResult {
        image_ID: String!       # Unique identifier of the image
        source: String!         # Source library: Unsplash, Storyblocks, or Pixabay
        thumbnails: String      # Thumbnail image URL
        preview: String         # Preview image URL
        title: String           # Image title or description
        tags: [String!]         # Array of image keywords/tags
    }

    type Query {
        searchImages(keyword: String!): [ImageResult!]!  # Search across all 3 image libraries
    }

    type Mutation {
        register(username: String!, password: String!): AuthPayload!  # Create new user account
        login(username: String!, password: String!): AuthPayload!     # Authenticate user, return JWT
    }
`

const resolvers = {
    Query: {
        // Search images from multiple sources (Unsplash, Pixabay, Storyblocks)
        searchImages: async (_, { keyword }, context) => {
            // Authentication check - require valid token
            if (!context.user) {
                throw new GraphQLError('Access denied: Please log in and provide a valid token.', {
                    extensions: { code: 'UNAUTHENTICATED' }
                });
            }

            try {
                // Parallel search across all 3 services, don't fail if one fails
                const results = await Promise.allSettled([
                    unsplashService.search(keyword),
                    pixabayService.search(keyword),
                    storyblocksService.search(keyword)
                ]);

                // Merge successful results only
                let compiledImages = [];
                results.forEach((result) => {
                    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                        compiledImages = compiledImages.concat(result.value);
                    }
                });

                return compiledImages;

            } catch (error) {
                console.error('GraphQL Search Error:', error);
                throw new GraphQLError('Internal server error', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' }
                });
            }
        }
    },

    Mutation: {
        // User registration
        register: async (_, { username, password }) => {
            try {
                // Check if username already exists
                const [existingUsers] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
                if (existingUsers.length > 0) {
                    throw new GraphQLError('This username has already been registered.', { extensions: { code: 'BAD_USER_INPUT' } });
                }

                // Hash password before storing (10 salt rounds)
                const hashedPassword = await bcrypt.hash(password, 10);
                await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

                return { message: 'Registration successful' };
            } catch (error) {
                if (error.extensions) throw error;
                console.error('Database Registration Error:', error);
                throw new GraphQLError('A database error occurred during the registration process.', { extensions: { code: 'INTERNAL_SERVER_ERROR' } });
            }
        },

        // User login - authenticate and issue JWT
        login: async (_, { username, password }) => {
            try {
                // Find user by username
                const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
                const user = rows[0];

                if (!user) {
                    throw new GraphQLError('Username or password incorrect', { extensions: { code: 'BAD_USER_INPUT' } });
                }

                // Verify password hash
                const validPassword = await bcrypt.compare(password, user.password);
                if (!validPassword) {
                    throw new GraphQLError('Username or password incorrect', { extensions: { code: 'BAD_USER_INPUT' } });
                }

                // Generate JWT token (expires in 2 hours)
                const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '2h' });

                return {
                    message: 'Login successful',
                    token: `Bearer ${token}`
                };
            } catch (error) {
                if (error.extensions) throw error;
                console.error('Database Login Error:', error);
                throw new GraphQLError('A database error occurred during the login process.', { extensions: { code: 'INTERNAL_SERVER_ERROR' } });
            }
        }
    }
}

module.exports = { typeDefs, resolvers };