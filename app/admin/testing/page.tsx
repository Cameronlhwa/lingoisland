import type {Metadata} from "next";
import {isTestingSession} from "@/lib/testing/server";
import TestingLogin from "./TestingLogin";
import TestingDashboard from "./TestingDashboard";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Testing | LingoIsland",robots:{index:false,follow:false}};
export default async function TestingPage(){return await isTestingSession()?<TestingDashboard/>:<TestingLogin/>;}
