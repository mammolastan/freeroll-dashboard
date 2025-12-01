import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      uid: string;
      nickname: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    uid?: string;
    nickname?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    nickname: string | null;
  }
}
