import Image from "next/image";
import type {GoalKey} from "@/lib/onboarding/personalized/goals";
const SCENES:Record<GoalKey,{src:string;alt:string}>={
 heritage:{src:"heritage",alt:"Huahua enjoying a conversation with family at home."},
 work:{src:"work",alt:"Huahua sharing ideas with colleagues."},
 school:{src:"school",alt:"Huahua learning with classmates."},
 travel:{src:"travel",alt:"Huahua talking with a local while exploring a new place."},
 everyday:{src:"everyday",alt:"Huahua chatting with friends in a garden café."},
 other:{src:"other",alt:"Huahua learning and chatting with a companion on the island."},
};
export function LessonIntroImage({goal}:{goal:GoalKey|null|undefined}){
 const scene=SCENES[goal??"other"]??SCENES.other;
 return <div data-testid="lesson-intro-image" data-goal={goal??"other"} className="overflow-hidden rounded-2xl" style={{background:"#fff9ef"}}>
  <Image src={`/onboarding/lesson-intro/${scene.src}-v1.webp`} alt={scene.alt} width={1080} height={360} sizes="(max-width: 639px) calc(100vw - 64px), 560px" priority className="block h-auto w-full"/>
 </div>;
}
