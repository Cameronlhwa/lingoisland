import {expect,test} from "@playwright/test";
// Real HTTP calls through middleware, with no route interception and no model spend.
for(const endpoint of ["writing","first-lesson"]){
 test(`guest onboarding ${endpoint} reaches validation without a subscription`,async({request,baseURL})=>{
  const response=await request.post(`/api/onboarding/${endpoint}`,{headers:{Origin:new URL(baseURL!).origin},data:{}});
  expect(response.status()).toBe(400);
  const foreign=await request.post(`/api/onboarding/${endpoint}`,{headers:{Origin:"https://foreign.example"},data:{}});
  expect(foreign.status()).toBe(403);
 });
}
