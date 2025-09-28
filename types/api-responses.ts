import type { SimpleQuestion } from './questions';

/**
 * Response from the /api/generate-questions endpoint
 */
export interface GenerateQuestionsResponse {
  questions: SimpleQuestion[];
  topic?: string;
  difficulty?: string;
  error?: never;
}

/**
 * Error response from the /api/generate-questions endpoint
 */
export interface GenerateQuestionsErrorResponse {
  error: string;
  message?: string;
  questions?: never;
}

/**
 * Union type for the complete API response
 */
export type GenerateQuestionsApiResponse =
  | GenerateQuestionsResponse
  | GenerateQuestionsErrorResponse;

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse(
  response: GenerateQuestionsApiResponse
): response is GenerateQuestionsResponse {
  return 'questions' in response && Array.isArray(response.questions);
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(
  response: GenerateQuestionsApiResponse
): response is GenerateQuestionsErrorResponse {
  return 'error' in response;
}
