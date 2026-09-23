import { analyze, massSet, parse } from '../src/index.ts';

// Compile-time regression checks; this file is not executed by the test runner.
export function publicTypes(input: unknown) {
  const result = analyze({ a: 1 });
  // @ts-expect-error Mass-set candidate lists are readonly.
  result.massSet.options.pop();
  // @ts-expect-error Standalone mass-set summaries are readonly too.
  massSet({ a: 1 }, 1).count = 0;
  const response = parse(input);
  // @ts-expect-error Lookup must allow a missing question id.
  response.answers.missing.type;
  // @ts-expect-error The answer dictionary is readonly.
  response.answers.replacement = undefined;
  const answer = response.answers.route;
  if (answer?.type === 'choice') {
    const providerChoice: string = answer.choice;
    return providerChoice;
  }
  return undefined;
}
