declare module "node-cron" {
  export function validate(expression: string): boolean;
  export function schedule(expression: string, fn: () => void): unknown;
  const cron: { validate: typeof validate; schedule: typeof schedule };
  export default cron;
}
