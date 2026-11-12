import "server-only";
import {cookies} from "next/headers";
import {SESSION_COOKIE,validTestingSession} from "./auth";
export async function isTestingSession(){return validTestingSession((await cookies()).get(SESSION_COOKIE)?.value,process.env.TESTING_SESSION_SECRET);}
