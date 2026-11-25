export class LessonError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}
