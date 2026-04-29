export class TaskPlanner {
  split(title: string): string[] {
    return [`Define success criteria for ${title}`, `Produce first pass for ${title}`, `Review and finalize ${title}`];
  }
}
