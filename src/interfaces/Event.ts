export interface Event {
  name: string;
  once: boolean;
  run: (...args: any[]) => Promise<void>;
}
