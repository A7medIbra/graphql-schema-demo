const { ApolloServer, gql } = require("apollo-server");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require("axios").default;

const usersDB = [];

const SECRET = process.env.SECRET || "ASIVCOJHWEFIOWEFNSDOVWSDD";

const restApi = axios.create({
  baseURL: "http://localhost:3000/",
  timeout: 10000,
  headers: {
    "X-Token": "xyzabc",
  },
});

const profile = {
  name: "Ahmed",
  email: "test@gmail.com",
  age: 12,
  isActive: true,
  id: "1sdjkvnd",
  role: "ADMIN",
};

const getProfileResolver = () => {
  // fetch from DB for example
  return profile;
};

const getUserByIDResolver = async (parent, args) => {
  const { userId } = args;
  const { data: user } = await restApi.get(`/users/${userId}`);

  return user;
};

const getUsersResolver = async (parent, args, ctx) => {
  if (!ctx.loggedUser) {
    throw new Error("UNAUTHORIZED");
  }
  const { count, page } = args.pagination;
  const response = await restApi.get(`/users?_limit=${count}&_page=${page}`);
  return response.data;
};

const loginUserResolver = async (parent, args) => {
  const { email, password } = args;
  const userItem = usersDB.find(user => user.email === email);
  
  if (!userItem) return { isSuccess: false, message: "Invalid credentials" };
  const hashedPassword = userItem.password;
  const isPasswordMatch = await bcrypt.compare(password, hashedPassword);
  if (!isPasswordMatch) return { isSuccess: false, message: "Invalid credentials" };

  const token = await jwt.sign(
    { email: userItem.email },
    SECRET,
    { expiresIn: '1d' }
  );

  return { isSuccess: true, message: "Login successful", token };
}

const registerUserResolver = async (parent, args) => {
  const { name, email, password } = args;
  console.log("creating user: ", email);

  const userExists = usersDB.find((user) => user.email === email);
  if (userExists)
    return {
      isSuccess: false,
      message: `User with this email '${email}' alread exists`,
    };
  
  const hash = await bcrypt.hash(password, 12);
  usersDB.push({ name, email, password: hash });
  console.log(usersDB);
  return { isSuccess: true, message: "user registered successfully" };
};

const getPostByIDResolver = async (parent, args) => {
  const { postId } = args;
  const { data: post } = await restApi.get(`/posts/${postId}`);
  const { data: comments } = await restApi.get(`/posts/${postId}/comments`);
  return {
    ...post,
    comments,
  };
};

const addCommentToPostResolver = async (parent, args) => {
  const { postId, comment } = args;
  const { data: newComment } = await restApi.post(`/posts/${postId}/comments`, comment);
  return newComment;
};


const typeDefs = gql`
  type User {
    id: ID!
    isActive: Boolean!
    age: Int!
    name: String!
    email: String!
    role: Role!
    posts(limit: Int): [Post]
  }

  type Post {
    id: ID!
    title: String!
    body: String!
    comments: [Comment]
  }

  type Comment {
    id: ID!
    name: String!
    body: String!
  }

  union SearchResult = User | Post | Comment

  enum Role {
    ADMIN
    USER
    GUEST
  }

  input PaginationInput {
    page: Int!
    count: Int!
  }

  input CommentInput {
    name: String!
    body: String!
  }

  type RegisterResponse {
    isSuccess: Boolean!
    message: String!
  }

  type Query {
    profile: User!
    getUsers(pagination: PaginationInput): [User!]!
    getUserByID(userId: String): User
    getPostById(postId: String!): Post
    search: SearchResult
  }

  type LoginResult {
    isSuccess: Boolean!
    message: String!
    token: String
  }

  type Mutation {
    register(
      email: String!
      name: String!
      password: String!
    ): RegisterResponse!

    login(email: String!, password: String!): LoginResult!

    addCommentToPost(postId: ID!, comment: CommentInput!): Comment!
  }
`;

const app = new ApolloServer({
  context: async (ctx) => {
    let loggedUser = null;
    const token = ctx?.req?.headers["authorization"];
    try {
      const payload = await jwt.verify(token, SECRET);
      loggedUser = payload;
    } catch (error) {
      console.log(error);
    }

    return {
      loggedUser
    }
  },
  typeDefs,
  resolvers: {
    User: {
      posts: async (parent, args) => {
        console.log("inside posts resolver: ", parent);
        const { data: userPosts } = await restApi.get(
          `/users/${parent.id}/posts?_limit=${args.limit}`
        );
        return userPosts;
      },
    },
    Query: {
      profile: getProfileResolver,
      getUsers: getUsersResolver,
      getUserByID: getUserByIDResolver,
      getPostById: getPostByIDResolver,
    },
    Mutation: {
      register: registerUserResolver,
      login: loginUserResolver,
      addCommentToPost: addCommentToPostResolver,
    },
  },
});

app.listen(3001, () => {
  console.log("server started");
});