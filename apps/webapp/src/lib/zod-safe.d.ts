declare const z: {
  string: () => ZodString;
  number: () => ZodNumber;
  boolean: () => ZodBoolean;
  array: <T>(schema: T) => ZodArray<T>;
  object: <T>(shape: T) => ZodObject<T>;
  enum: (values: [string, ...string[]]) => ZodEnum;
  literal: (value: string | number | boolean) => ZodLiteral;
  union: (schemas: [ZodTypeAny, ...ZodTypeAny[]]) => ZodUnion;
  discriminatedUnion: (discriminator: string, schemas: [ZodTypeAny, ...ZodTypeAny[]]) => ZodDiscriminatedUnion;
  intersection: (left: ZodTypeAny, right: ZodTypeAny) => ZodIntersection;
  record: (key: ZodString, value: ZodTypeAny) => ZodRecord;
  optional: <T>(schema: T) => ZodOptional<T>;
  nullable: <T>(schema: T) => ZodNullable<T>;
};

interface ZodTypeAny {
  describe(description: string): this;
  optional(): ZodOptional<this>;
  nullable(): ZodNullable<this>;
  default(value: any): this;
}

interface ZodString extends ZodTypeAny {
  min(length: number, message?: string): this;
  max(length: number, message?: string): this;
  email(message?: string): this;
  url(message?: string): this;
  regex(regex: RegExp, message?: string): this;
}

interface ZodNumber extends ZodTypeAny {
  min(value: number, message?: string): this;
  max(value: number, message?: string): this;
  int(message?: string): this;
  positive(message?: string): this;
  nonnegative(message?: string): this;
}

interface ZodBoolean extends ZodTypeAny {}

interface ZodArray<T> extends ZodTypeAny {
  element: T;
  min(length: number, message?: string): this;
  max(length: number, message?: string): this;
  length(length: number, message?: string): this;
}

interface ZodObject<T> extends ZodTypeAny {
  shape: T;
}

interface ZodEnum extends ZodTypeAny {
  enum: Record<string, string>;
}

interface ZodLiteral extends ZodTypeAny {
  value: any;
}

interface ZodUnion extends ZodTypeAny {
  options: ZodTypeAny[];
}

interface ZodDiscriminatedUnion extends ZodTypeAny {
  discriminator: string;
  options: ZodObject<any>[];
}

interface ZodIntersection extends ZodTypeAny {
  left: ZodTypeAny;
  right: ZodTypeAny;
}

interface ZodRecord extends ZodTypeAny {
  keySchema: ZodString;
  valueSchema: ZodTypeAny;
}

interface ZodOptional<T> extends ZodTypeAny {
  unwrap(): T;
}

interface ZodNullable<T> extends ZodTypeAny {
  unwrap(): T;
}
