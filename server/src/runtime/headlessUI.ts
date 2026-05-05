type RuntimeEvent =
  | { type: 'message'; message: string; answers: string[]; at: string }
  | { type: 'file:sent'; path: string; at: string }
  | { type: 'file:deleted'; path: string; at: string }
  | { type: 'input:requested'; at: string }
  | { type: 'file:requested'; pathToSave: string; name: string; at: string }
  | { type: 'finished'; at: string };

export class HeadlessUI {
  private readonly events: RuntimeEvent[] = [];

  async sendMessage(message: string, answers: string[]): Promise<void> {
    this.pushEvent({
      type: 'message',
      message,
      answers: [...answers],
      at: new Date().toISOString(),
    });
  }

  async getInput(): Promise<string> {
    this.pushEvent({
      type: 'input:requested',
      at: new Date().toISOString(),
    });
    throw new Error('Headless engine runtime does not accept interactive input');
  }

  async getFile(pathToSave: string, name: string): Promise<string> {
    this.pushEvent({
      type: 'file:requested',
      pathToSave,
      name,
      at: new Date().toISOString(),
    });
    throw new Error('Headless engine runtime does not accept file input');
  }

  sendFile(path: string): void {
    this.pushEvent({
      type: 'file:sent',
      path,
      at: new Date().toISOString(),
    });
  }

  deleteFile(path: string): void {
    this.pushEvent({
      type: 'file:deleted',
      path,
      at: new Date().toISOString(),
    });
  }

  finish(): void {
    this.pushEvent({
      type: 'finished',
      at: new Date().toISOString(),
    });
  }

  getEvents(): RuntimeEvent[] {
    return [...this.events];
  }

  private pushEvent(event: RuntimeEvent): void {
    this.events.push(event);
    if (this.events.length > 100) {
      this.events.shift();
    }
  }
}
