export interface Event {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (...args: any[]) => Promise<void>;
}
