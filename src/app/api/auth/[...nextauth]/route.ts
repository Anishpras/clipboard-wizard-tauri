import NextAuth from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
const loginUserSchema = z.object({
  email: z.string(),
  password: z.string(),
});
const prisma = new PrismaClient();

const handler = NextAuth({
  callbacks: {
    session: async ({ session, token }) => {
      return {
        ...session,
      };
    },
    async jwt({ token, account, user }) {
      const userDetails = await prisma.user.findUnique({
        where: {
          email: token.email ?? "",
        },
      });
      if (account) {
        token.accessToken = account.access_token;
        token.id = user.id;
        token.email = (user as User).email;
      }
      return { ...token, ...userDetails };
    },
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        // email attribute can be  user email or user username.
        email: { label: "email", type: "text" },
        password: { label: "password", type: "password" },
      },
      type: "credentials",
      authorize: async (credentials) => {
        const { email, password } = loginUserSchema.parse(credentials);
        // Fetch the user from the database based on the provided username
        const user = await prisma.user.findFirst({
          where: {
            email: email.toLowerCase(),
          },
          select: {
            id: true,
            email: true,
            password: true,
          },
        });
        if (user && bcrypt?.compareSync(password, user?.password ?? "")) {
          // Include the desired user properties in the session
          return Promise.resolve({
            id: user.id,
            email: user.email,
          });
        } else {
          return Promise.resolve(null);
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

export { handler as GET, handler as POST };
