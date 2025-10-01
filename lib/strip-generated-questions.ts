export type GeneratedQuestionPayload = {
  id?: number | string;
  [key: string]: unknown;
};

export type SanitizedGeneratedQuestion = Omit<GeneratedQuestionPayload, 'id'>;

export const stripGeneratedQuestionMetadata = (
  questions: GeneratedQuestionPayload[]
): SanitizedGeneratedQuestion[] =>
  questions.map((question) => {
    const sanitized = { ...question };
    delete sanitized.id;
    return sanitized as SanitizedGeneratedQuestion;
  });
