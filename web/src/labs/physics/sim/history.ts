/** Fixed-capacity ring buffer of multi-channel samples (oldest → newest by index). */
export class History {
  private readonly times: Float64Array;
  private readonly data: Float64Array[];
  private head = 0;
  private size = 0;

  constructor(
    readonly capacity: number,
    readonly channels: number,
  ) {
    this.times = new Float64Array(capacity);
    this.data = Array.from({ length: channels }, () => new Float64Array(capacity));
  }

  get length(): number {
    return this.size;
  }

  clear(): void {
    this.head = 0;
    this.size = 0;
  }

  push(t: number, values: ArrayLike<number>): void {
    this.times[this.head] = t;
    for (let c = 0; c < this.channels; c++) this.data[c]![this.head] = values[c] ?? 0;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) this.size++;
  }

  private slot(i: number): number {
    return (this.head - this.size + i + this.capacity * 2) % this.capacity;
  }

  time(i: number): number {
    return this.times[this.slot(i)]!;
  }

  value(channel: number, i: number): number {
    return this.data[channel]![this.slot(i)]!;
  }
}
