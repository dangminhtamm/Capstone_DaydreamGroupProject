
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model CalendarEvent
 * 
 */
export type CalendarEvent = $Result.DefaultSelection<Prisma.$CalendarEventPayload>
/**
 * Model Summary
 * 
 */
export type Summary = $Result.DefaultSelection<Prisma.$SummaryPayload>
/**
 * Model EntityMention
 * 
 */
export type EntityMention = $Result.DefaultSelection<Prisma.$EntityMentionPayload>
/**
 * Model GmailMessage
 * 
 */
export type GmailMessage = $Result.DefaultSelection<Prisma.$GmailMessagePayload>
/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model DiaryEntry
 * 
 */
export type DiaryEntry = $Result.DefaultSelection<Prisma.$DiaryEntryPayload>
/**
 * Model Attachment
 * 
 */
export type Attachment = $Result.DefaultSelection<Prisma.$AttachmentPayload>
/**
 * Model MemoryChunk
 * 
 */
export type MemoryChunk = $Result.DefaultSelection<Prisma.$MemoryChunkPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more CalendarEvents
 * const calendarEvents = await prisma.calendarEvent.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more CalendarEvents
   * const calendarEvents = await prisma.calendarEvent.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.calendarEvent`: Exposes CRUD operations for the **CalendarEvent** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CalendarEvents
    * const calendarEvents = await prisma.calendarEvent.findMany()
    * ```
    */
  get calendarEvent(): Prisma.CalendarEventDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.summary`: Exposes CRUD operations for the **Summary** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Summaries
    * const summaries = await prisma.summary.findMany()
    * ```
    */
  get summary(): Prisma.SummaryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.entityMention`: Exposes CRUD operations for the **EntityMention** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more EntityMentions
    * const entityMentions = await prisma.entityMention.findMany()
    * ```
    */
  get entityMention(): Prisma.EntityMentionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.gmailMessage`: Exposes CRUD operations for the **GmailMessage** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more GmailMessages
    * const gmailMessages = await prisma.gmailMessage.findMany()
    * ```
    */
  get gmailMessage(): Prisma.GmailMessageDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.diaryEntry`: Exposes CRUD operations for the **DiaryEntry** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more DiaryEntries
    * const diaryEntries = await prisma.diaryEntry.findMany()
    * ```
    */
  get diaryEntry(): Prisma.DiaryEntryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.attachment`: Exposes CRUD operations for the **Attachment** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Attachments
    * const attachments = await prisma.attachment.findMany()
    * ```
    */
  get attachment(): Prisma.AttachmentDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.memoryChunk`: Exposes CRUD operations for the **MemoryChunk** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MemoryChunks
    * const memoryChunks = await prisma.memoryChunk.findMany()
    * ```
    */
  get memoryChunk(): Prisma.MemoryChunkDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.8.0
   * Query Engine version: 3c6e192761c0362d496ed980de936e2f3cebcd3a
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    CalendarEvent: 'CalendarEvent',
    Summary: 'Summary',
    EntityMention: 'EntityMention',
    GmailMessage: 'GmailMessage',
    User: 'User',
    DiaryEntry: 'DiaryEntry',
    Attachment: 'Attachment',
    MemoryChunk: 'MemoryChunk'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "calendarEvent" | "summary" | "entityMention" | "gmailMessage" | "user" | "diaryEntry" | "attachment" | "memoryChunk"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      CalendarEvent: {
        payload: Prisma.$CalendarEventPayload<ExtArgs>
        fields: Prisma.CalendarEventFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CalendarEventFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CalendarEventFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload>
          }
          findFirst: {
            args: Prisma.CalendarEventFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CalendarEventFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload>
          }
          findMany: {
            args: Prisma.CalendarEventFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload>[]
          }
          create: {
            args: Prisma.CalendarEventCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload>
          }
          createMany: {
            args: Prisma.CalendarEventCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CalendarEventCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload>[]
          }
          delete: {
            args: Prisma.CalendarEventDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload>
          }
          update: {
            args: Prisma.CalendarEventUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload>
          }
          deleteMany: {
            args: Prisma.CalendarEventDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CalendarEventUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CalendarEventUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload>[]
          }
          upsert: {
            args: Prisma.CalendarEventUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CalendarEventPayload>
          }
          aggregate: {
            args: Prisma.CalendarEventAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCalendarEvent>
          }
          groupBy: {
            args: Prisma.CalendarEventGroupByArgs<ExtArgs>
            result: $Utils.Optional<CalendarEventGroupByOutputType>[]
          }
          count: {
            args: Prisma.CalendarEventCountArgs<ExtArgs>
            result: $Utils.Optional<CalendarEventCountAggregateOutputType> | number
          }
        }
      }
      Summary: {
        payload: Prisma.$SummaryPayload<ExtArgs>
        fields: Prisma.SummaryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SummaryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SummaryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload>
          }
          findFirst: {
            args: Prisma.SummaryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SummaryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload>
          }
          findMany: {
            args: Prisma.SummaryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload>[]
          }
          create: {
            args: Prisma.SummaryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload>
          }
          createMany: {
            args: Prisma.SummaryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SummaryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload>[]
          }
          delete: {
            args: Prisma.SummaryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload>
          }
          update: {
            args: Prisma.SummaryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload>
          }
          deleteMany: {
            args: Prisma.SummaryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SummaryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SummaryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload>[]
          }
          upsert: {
            args: Prisma.SummaryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SummaryPayload>
          }
          aggregate: {
            args: Prisma.SummaryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSummary>
          }
          groupBy: {
            args: Prisma.SummaryGroupByArgs<ExtArgs>
            result: $Utils.Optional<SummaryGroupByOutputType>[]
          }
          count: {
            args: Prisma.SummaryCountArgs<ExtArgs>
            result: $Utils.Optional<SummaryCountAggregateOutputType> | number
          }
        }
      }
      EntityMention: {
        payload: Prisma.$EntityMentionPayload<ExtArgs>
        fields: Prisma.EntityMentionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EntityMentionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EntityMentionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload>
          }
          findFirst: {
            args: Prisma.EntityMentionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EntityMentionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload>
          }
          findMany: {
            args: Prisma.EntityMentionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload>[]
          }
          create: {
            args: Prisma.EntityMentionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload>
          }
          createMany: {
            args: Prisma.EntityMentionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.EntityMentionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload>[]
          }
          delete: {
            args: Prisma.EntityMentionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload>
          }
          update: {
            args: Prisma.EntityMentionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload>
          }
          deleteMany: {
            args: Prisma.EntityMentionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.EntityMentionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.EntityMentionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload>[]
          }
          upsert: {
            args: Prisma.EntityMentionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EntityMentionPayload>
          }
          aggregate: {
            args: Prisma.EntityMentionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEntityMention>
          }
          groupBy: {
            args: Prisma.EntityMentionGroupByArgs<ExtArgs>
            result: $Utils.Optional<EntityMentionGroupByOutputType>[]
          }
          count: {
            args: Prisma.EntityMentionCountArgs<ExtArgs>
            result: $Utils.Optional<EntityMentionCountAggregateOutputType> | number
          }
        }
      }
      GmailMessage: {
        payload: Prisma.$GmailMessagePayload<ExtArgs>
        fields: Prisma.GmailMessageFieldRefs
        operations: {
          findUnique: {
            args: Prisma.GmailMessageFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.GmailMessageFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload>
          }
          findFirst: {
            args: Prisma.GmailMessageFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.GmailMessageFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload>
          }
          findMany: {
            args: Prisma.GmailMessageFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload>[]
          }
          create: {
            args: Prisma.GmailMessageCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload>
          }
          createMany: {
            args: Prisma.GmailMessageCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.GmailMessageCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload>[]
          }
          delete: {
            args: Prisma.GmailMessageDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload>
          }
          update: {
            args: Prisma.GmailMessageUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload>
          }
          deleteMany: {
            args: Prisma.GmailMessageDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.GmailMessageUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.GmailMessageUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload>[]
          }
          upsert: {
            args: Prisma.GmailMessageUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GmailMessagePayload>
          }
          aggregate: {
            args: Prisma.GmailMessageAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGmailMessage>
          }
          groupBy: {
            args: Prisma.GmailMessageGroupByArgs<ExtArgs>
            result: $Utils.Optional<GmailMessageGroupByOutputType>[]
          }
          count: {
            args: Prisma.GmailMessageCountArgs<ExtArgs>
            result: $Utils.Optional<GmailMessageCountAggregateOutputType> | number
          }
        }
      }
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      DiaryEntry: {
        payload: Prisma.$DiaryEntryPayload<ExtArgs>
        fields: Prisma.DiaryEntryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DiaryEntryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DiaryEntryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload>
          }
          findFirst: {
            args: Prisma.DiaryEntryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DiaryEntryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload>
          }
          findMany: {
            args: Prisma.DiaryEntryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload>[]
          }
          create: {
            args: Prisma.DiaryEntryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload>
          }
          createMany: {
            args: Prisma.DiaryEntryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DiaryEntryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload>[]
          }
          delete: {
            args: Prisma.DiaryEntryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload>
          }
          update: {
            args: Prisma.DiaryEntryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload>
          }
          deleteMany: {
            args: Prisma.DiaryEntryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DiaryEntryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.DiaryEntryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload>[]
          }
          upsert: {
            args: Prisma.DiaryEntryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DiaryEntryPayload>
          }
          aggregate: {
            args: Prisma.DiaryEntryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDiaryEntry>
          }
          groupBy: {
            args: Prisma.DiaryEntryGroupByArgs<ExtArgs>
            result: $Utils.Optional<DiaryEntryGroupByOutputType>[]
          }
          count: {
            args: Prisma.DiaryEntryCountArgs<ExtArgs>
            result: $Utils.Optional<DiaryEntryCountAggregateOutputType> | number
          }
        }
      }
      Attachment: {
        payload: Prisma.$AttachmentPayload<ExtArgs>
        fields: Prisma.AttachmentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AttachmentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AttachmentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload>
          }
          findFirst: {
            args: Prisma.AttachmentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AttachmentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload>
          }
          findMany: {
            args: Prisma.AttachmentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload>[]
          }
          create: {
            args: Prisma.AttachmentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload>
          }
          createMany: {
            args: Prisma.AttachmentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AttachmentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload>[]
          }
          delete: {
            args: Prisma.AttachmentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload>
          }
          update: {
            args: Prisma.AttachmentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload>
          }
          deleteMany: {
            args: Prisma.AttachmentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AttachmentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AttachmentUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload>[]
          }
          upsert: {
            args: Prisma.AttachmentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AttachmentPayload>
          }
          aggregate: {
            args: Prisma.AttachmentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAttachment>
          }
          groupBy: {
            args: Prisma.AttachmentGroupByArgs<ExtArgs>
            result: $Utils.Optional<AttachmentGroupByOutputType>[]
          }
          count: {
            args: Prisma.AttachmentCountArgs<ExtArgs>
            result: $Utils.Optional<AttachmentCountAggregateOutputType> | number
          }
        }
      }
      MemoryChunk: {
        payload: Prisma.$MemoryChunkPayload<ExtArgs>
        fields: Prisma.MemoryChunkFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MemoryChunkFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MemoryChunkFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload>
          }
          findFirst: {
            args: Prisma.MemoryChunkFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MemoryChunkFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload>
          }
          findMany: {
            args: Prisma.MemoryChunkFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload>[]
          }
          create: {
            args: Prisma.MemoryChunkCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload>
          }
          createMany: {
            args: Prisma.MemoryChunkCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MemoryChunkCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload>[]
          }
          delete: {
            args: Prisma.MemoryChunkDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload>
          }
          update: {
            args: Prisma.MemoryChunkUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload>
          }
          deleteMany: {
            args: Prisma.MemoryChunkDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MemoryChunkUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MemoryChunkUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload>[]
          }
          upsert: {
            args: Prisma.MemoryChunkUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MemoryChunkPayload>
          }
          aggregate: {
            args: Prisma.MemoryChunkAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMemoryChunk>
          }
          groupBy: {
            args: Prisma.MemoryChunkGroupByArgs<ExtArgs>
            result: $Utils.Optional<MemoryChunkGroupByOutputType>[]
          }
          count: {
            args: Prisma.MemoryChunkCountArgs<ExtArgs>
            result: $Utils.Optional<MemoryChunkCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    calendarEvent?: CalendarEventOmit
    summary?: SummaryOmit
    entityMention?: EntityMentionOmit
    gmailMessage?: GmailMessageOmit
    user?: UserOmit
    diaryEntry?: DiaryEntryOmit
    attachment?: AttachmentOmit
    memoryChunk?: MemoryChunkOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    diary_entries: number
    memory_chunks: number
    summaries: number
    calendar_events: number
    gmail_messages: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    diary_entries?: boolean | UserCountOutputTypeCountDiary_entriesArgs
    memory_chunks?: boolean | UserCountOutputTypeCountMemory_chunksArgs
    summaries?: boolean | UserCountOutputTypeCountSummariesArgs
    calendar_events?: boolean | UserCountOutputTypeCountCalendar_eventsArgs
    gmail_messages?: boolean | UserCountOutputTypeCountGmail_messagesArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountDiary_entriesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DiaryEntryWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountMemory_chunksArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MemoryChunkWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSummariesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SummaryWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountCalendar_eventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CalendarEventWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountGmail_messagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: GmailMessageWhereInput
  }


  /**
   * Count Type DiaryEntryCountOutputType
   */

  export type DiaryEntryCountOutputType = {
    attachments: number
    calendar_events: number
  }

  export type DiaryEntryCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    attachments?: boolean | DiaryEntryCountOutputTypeCountAttachmentsArgs
    calendar_events?: boolean | DiaryEntryCountOutputTypeCountCalendar_eventsArgs
  }

  // Custom InputTypes
  /**
   * DiaryEntryCountOutputType without action
   */
  export type DiaryEntryCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntryCountOutputType
     */
    select?: DiaryEntryCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * DiaryEntryCountOutputType without action
   */
  export type DiaryEntryCountOutputTypeCountAttachmentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AttachmentWhereInput
  }

  /**
   * DiaryEntryCountOutputType without action
   */
  export type DiaryEntryCountOutputTypeCountCalendar_eventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CalendarEventWhereInput
  }


  /**
   * Count Type MemoryChunkCountOutputType
   */

  export type MemoryChunkCountOutputType = {
    entity_mentions: number
  }

  export type MemoryChunkCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    entity_mentions?: boolean | MemoryChunkCountOutputTypeCountEntity_mentionsArgs
  }

  // Custom InputTypes
  /**
   * MemoryChunkCountOutputType without action
   */
  export type MemoryChunkCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunkCountOutputType
     */
    select?: MemoryChunkCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * MemoryChunkCountOutputType without action
   */
  export type MemoryChunkCountOutputTypeCountEntity_mentionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EntityMentionWhereInput
  }


  /**
   * Models
   */

  /**
   * Model CalendarEvent
   */

  export type AggregateCalendarEvent = {
    _count: CalendarEventCountAggregateOutputType | null
    _min: CalendarEventMinAggregateOutputType | null
    _max: CalendarEventMaxAggregateOutputType | null
  }

  export type CalendarEventMinAggregateOutputType = {
    id: string | null
    user_id: string | null
    external_id: string | null
    title: string | null
    start_time: Date | null
    end_time: Date | null
    diary_entry_id: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type CalendarEventMaxAggregateOutputType = {
    id: string | null
    user_id: string | null
    external_id: string | null
    title: string | null
    start_time: Date | null
    end_time: Date | null
    diary_entry_id: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type CalendarEventCountAggregateOutputType = {
    id: number
    user_id: number
    external_id: number
    title: number
    start_time: number
    end_time: number
    diary_entry_id: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type CalendarEventMinAggregateInputType = {
    id?: true
    user_id?: true
    external_id?: true
    title?: true
    start_time?: true
    end_time?: true
    diary_entry_id?: true
    created_at?: true
    updated_at?: true
  }

  export type CalendarEventMaxAggregateInputType = {
    id?: true
    user_id?: true
    external_id?: true
    title?: true
    start_time?: true
    end_time?: true
    diary_entry_id?: true
    created_at?: true
    updated_at?: true
  }

  export type CalendarEventCountAggregateInputType = {
    id?: true
    user_id?: true
    external_id?: true
    title?: true
    start_time?: true
    end_time?: true
    diary_entry_id?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type CalendarEventAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CalendarEvent to aggregate.
     */
    where?: CalendarEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CalendarEvents to fetch.
     */
    orderBy?: CalendarEventOrderByWithRelationInput | CalendarEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CalendarEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CalendarEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CalendarEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CalendarEvents
    **/
    _count?: true | CalendarEventCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CalendarEventMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CalendarEventMaxAggregateInputType
  }

  export type GetCalendarEventAggregateType<T extends CalendarEventAggregateArgs> = {
        [P in keyof T & keyof AggregateCalendarEvent]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCalendarEvent[P]>
      : GetScalarType<T[P], AggregateCalendarEvent[P]>
  }




  export type CalendarEventGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CalendarEventWhereInput
    orderBy?: CalendarEventOrderByWithAggregationInput | CalendarEventOrderByWithAggregationInput[]
    by: CalendarEventScalarFieldEnum[] | CalendarEventScalarFieldEnum
    having?: CalendarEventScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CalendarEventCountAggregateInputType | true
    _min?: CalendarEventMinAggregateInputType
    _max?: CalendarEventMaxAggregateInputType
  }

  export type CalendarEventGroupByOutputType = {
    id: string
    user_id: string
    external_id: string
    title: string
    start_time: Date
    end_time: Date
    diary_entry_id: string | null
    created_at: Date
    updated_at: Date
    _count: CalendarEventCountAggregateOutputType | null
    _min: CalendarEventMinAggregateOutputType | null
    _max: CalendarEventMaxAggregateOutputType | null
  }

  type GetCalendarEventGroupByPayload<T extends CalendarEventGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CalendarEventGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CalendarEventGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CalendarEventGroupByOutputType[P]>
            : GetScalarType<T[P], CalendarEventGroupByOutputType[P]>
        }
      >
    >


  export type CalendarEventSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    external_id?: boolean
    title?: boolean
    start_time?: boolean
    end_time?: boolean
    diary_entry_id?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    diary_entry?: boolean | CalendarEvent$diary_entryArgs<ExtArgs>
  }, ExtArgs["result"]["calendarEvent"]>

  export type CalendarEventSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    external_id?: boolean
    title?: boolean
    start_time?: boolean
    end_time?: boolean
    diary_entry_id?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    diary_entry?: boolean | CalendarEvent$diary_entryArgs<ExtArgs>
  }, ExtArgs["result"]["calendarEvent"]>

  export type CalendarEventSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    external_id?: boolean
    title?: boolean
    start_time?: boolean
    end_time?: boolean
    diary_entry_id?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    diary_entry?: boolean | CalendarEvent$diary_entryArgs<ExtArgs>
  }, ExtArgs["result"]["calendarEvent"]>

  export type CalendarEventSelectScalar = {
    id?: boolean
    user_id?: boolean
    external_id?: boolean
    title?: boolean
    start_time?: boolean
    end_time?: boolean
    diary_entry_id?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type CalendarEventOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "user_id" | "external_id" | "title" | "start_time" | "end_time" | "diary_entry_id" | "created_at" | "updated_at", ExtArgs["result"]["calendarEvent"]>
  export type CalendarEventInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    diary_entry?: boolean | CalendarEvent$diary_entryArgs<ExtArgs>
  }
  export type CalendarEventIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    diary_entry?: boolean | CalendarEvent$diary_entryArgs<ExtArgs>
  }
  export type CalendarEventIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    diary_entry?: boolean | CalendarEvent$diary_entryArgs<ExtArgs>
  }

  export type $CalendarEventPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CalendarEvent"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      diary_entry: Prisma.$DiaryEntryPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      user_id: string
      external_id: string
      title: string
      start_time: Date
      end_time: Date
      diary_entry_id: string | null
      created_at: Date
      updated_at: Date
    }, ExtArgs["result"]["calendarEvent"]>
    composites: {}
  }

  type CalendarEventGetPayload<S extends boolean | null | undefined | CalendarEventDefaultArgs> = $Result.GetResult<Prisma.$CalendarEventPayload, S>

  type CalendarEventCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CalendarEventFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CalendarEventCountAggregateInputType | true
    }

  export interface CalendarEventDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CalendarEvent'], meta: { name: 'CalendarEvent' } }
    /**
     * Find zero or one CalendarEvent that matches the filter.
     * @param {CalendarEventFindUniqueArgs} args - Arguments to find a CalendarEvent
     * @example
     * // Get one CalendarEvent
     * const calendarEvent = await prisma.calendarEvent.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CalendarEventFindUniqueArgs>(args: SelectSubset<T, CalendarEventFindUniqueArgs<ExtArgs>>): Prisma__CalendarEventClient<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CalendarEvent that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CalendarEventFindUniqueOrThrowArgs} args - Arguments to find a CalendarEvent
     * @example
     * // Get one CalendarEvent
     * const calendarEvent = await prisma.calendarEvent.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CalendarEventFindUniqueOrThrowArgs>(args: SelectSubset<T, CalendarEventFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CalendarEventClient<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CalendarEvent that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarEventFindFirstArgs} args - Arguments to find a CalendarEvent
     * @example
     * // Get one CalendarEvent
     * const calendarEvent = await prisma.calendarEvent.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CalendarEventFindFirstArgs>(args?: SelectSubset<T, CalendarEventFindFirstArgs<ExtArgs>>): Prisma__CalendarEventClient<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CalendarEvent that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarEventFindFirstOrThrowArgs} args - Arguments to find a CalendarEvent
     * @example
     * // Get one CalendarEvent
     * const calendarEvent = await prisma.calendarEvent.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CalendarEventFindFirstOrThrowArgs>(args?: SelectSubset<T, CalendarEventFindFirstOrThrowArgs<ExtArgs>>): Prisma__CalendarEventClient<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CalendarEvents that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarEventFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CalendarEvents
     * const calendarEvents = await prisma.calendarEvent.findMany()
     * 
     * // Get first 10 CalendarEvents
     * const calendarEvents = await prisma.calendarEvent.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const calendarEventWithIdOnly = await prisma.calendarEvent.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CalendarEventFindManyArgs>(args?: SelectSubset<T, CalendarEventFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CalendarEvent.
     * @param {CalendarEventCreateArgs} args - Arguments to create a CalendarEvent.
     * @example
     * // Create one CalendarEvent
     * const CalendarEvent = await prisma.calendarEvent.create({
     *   data: {
     *     // ... data to create a CalendarEvent
     *   }
     * })
     * 
     */
    create<T extends CalendarEventCreateArgs>(args: SelectSubset<T, CalendarEventCreateArgs<ExtArgs>>): Prisma__CalendarEventClient<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CalendarEvents.
     * @param {CalendarEventCreateManyArgs} args - Arguments to create many CalendarEvents.
     * @example
     * // Create many CalendarEvents
     * const calendarEvent = await prisma.calendarEvent.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CalendarEventCreateManyArgs>(args?: SelectSubset<T, CalendarEventCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CalendarEvents and returns the data saved in the database.
     * @param {CalendarEventCreateManyAndReturnArgs} args - Arguments to create many CalendarEvents.
     * @example
     * // Create many CalendarEvents
     * const calendarEvent = await prisma.calendarEvent.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CalendarEvents and only return the `id`
     * const calendarEventWithIdOnly = await prisma.calendarEvent.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CalendarEventCreateManyAndReturnArgs>(args?: SelectSubset<T, CalendarEventCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CalendarEvent.
     * @param {CalendarEventDeleteArgs} args - Arguments to delete one CalendarEvent.
     * @example
     * // Delete one CalendarEvent
     * const CalendarEvent = await prisma.calendarEvent.delete({
     *   where: {
     *     // ... filter to delete one CalendarEvent
     *   }
     * })
     * 
     */
    delete<T extends CalendarEventDeleteArgs>(args: SelectSubset<T, CalendarEventDeleteArgs<ExtArgs>>): Prisma__CalendarEventClient<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CalendarEvent.
     * @param {CalendarEventUpdateArgs} args - Arguments to update one CalendarEvent.
     * @example
     * // Update one CalendarEvent
     * const calendarEvent = await prisma.calendarEvent.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CalendarEventUpdateArgs>(args: SelectSubset<T, CalendarEventUpdateArgs<ExtArgs>>): Prisma__CalendarEventClient<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CalendarEvents.
     * @param {CalendarEventDeleteManyArgs} args - Arguments to filter CalendarEvents to delete.
     * @example
     * // Delete a few CalendarEvents
     * const { count } = await prisma.calendarEvent.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CalendarEventDeleteManyArgs>(args?: SelectSubset<T, CalendarEventDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CalendarEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarEventUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CalendarEvents
     * const calendarEvent = await prisma.calendarEvent.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CalendarEventUpdateManyArgs>(args: SelectSubset<T, CalendarEventUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CalendarEvents and returns the data updated in the database.
     * @param {CalendarEventUpdateManyAndReturnArgs} args - Arguments to update many CalendarEvents.
     * @example
     * // Update many CalendarEvents
     * const calendarEvent = await prisma.calendarEvent.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CalendarEvents and only return the `id`
     * const calendarEventWithIdOnly = await prisma.calendarEvent.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CalendarEventUpdateManyAndReturnArgs>(args: SelectSubset<T, CalendarEventUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CalendarEvent.
     * @param {CalendarEventUpsertArgs} args - Arguments to update or create a CalendarEvent.
     * @example
     * // Update or create a CalendarEvent
     * const calendarEvent = await prisma.calendarEvent.upsert({
     *   create: {
     *     // ... data to create a CalendarEvent
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CalendarEvent we want to update
     *   }
     * })
     */
    upsert<T extends CalendarEventUpsertArgs>(args: SelectSubset<T, CalendarEventUpsertArgs<ExtArgs>>): Prisma__CalendarEventClient<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CalendarEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarEventCountArgs} args - Arguments to filter CalendarEvents to count.
     * @example
     * // Count the number of CalendarEvents
     * const count = await prisma.calendarEvent.count({
     *   where: {
     *     // ... the filter for the CalendarEvents we want to count
     *   }
     * })
    **/
    count<T extends CalendarEventCountArgs>(
      args?: Subset<T, CalendarEventCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CalendarEventCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CalendarEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarEventAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CalendarEventAggregateArgs>(args: Subset<T, CalendarEventAggregateArgs>): Prisma.PrismaPromise<GetCalendarEventAggregateType<T>>

    /**
     * Group by CalendarEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CalendarEventGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CalendarEventGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CalendarEventGroupByArgs['orderBy'] }
        : { orderBy?: CalendarEventGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CalendarEventGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCalendarEventGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CalendarEvent model
   */
  readonly fields: CalendarEventFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CalendarEvent.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CalendarEventClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    diary_entry<T extends CalendarEvent$diary_entryArgs<ExtArgs> = {}>(args?: Subset<T, CalendarEvent$diary_entryArgs<ExtArgs>>): Prisma__DiaryEntryClient<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CalendarEvent model
   */
  interface CalendarEventFieldRefs {
    readonly id: FieldRef<"CalendarEvent", 'String'>
    readonly user_id: FieldRef<"CalendarEvent", 'String'>
    readonly external_id: FieldRef<"CalendarEvent", 'String'>
    readonly title: FieldRef<"CalendarEvent", 'String'>
    readonly start_time: FieldRef<"CalendarEvent", 'DateTime'>
    readonly end_time: FieldRef<"CalendarEvent", 'DateTime'>
    readonly diary_entry_id: FieldRef<"CalendarEvent", 'String'>
    readonly created_at: FieldRef<"CalendarEvent", 'DateTime'>
    readonly updated_at: FieldRef<"CalendarEvent", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CalendarEvent findUnique
   */
  export type CalendarEventFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    /**
     * Filter, which CalendarEvent to fetch.
     */
    where: CalendarEventWhereUniqueInput
  }

  /**
   * CalendarEvent findUniqueOrThrow
   */
  export type CalendarEventFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    /**
     * Filter, which CalendarEvent to fetch.
     */
    where: CalendarEventWhereUniqueInput
  }

  /**
   * CalendarEvent findFirst
   */
  export type CalendarEventFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    /**
     * Filter, which CalendarEvent to fetch.
     */
    where?: CalendarEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CalendarEvents to fetch.
     */
    orderBy?: CalendarEventOrderByWithRelationInput | CalendarEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CalendarEvents.
     */
    cursor?: CalendarEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CalendarEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CalendarEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CalendarEvents.
     */
    distinct?: CalendarEventScalarFieldEnum | CalendarEventScalarFieldEnum[]
  }

  /**
   * CalendarEvent findFirstOrThrow
   */
  export type CalendarEventFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    /**
     * Filter, which CalendarEvent to fetch.
     */
    where?: CalendarEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CalendarEvents to fetch.
     */
    orderBy?: CalendarEventOrderByWithRelationInput | CalendarEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CalendarEvents.
     */
    cursor?: CalendarEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CalendarEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CalendarEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CalendarEvents.
     */
    distinct?: CalendarEventScalarFieldEnum | CalendarEventScalarFieldEnum[]
  }

  /**
   * CalendarEvent findMany
   */
  export type CalendarEventFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    /**
     * Filter, which CalendarEvents to fetch.
     */
    where?: CalendarEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CalendarEvents to fetch.
     */
    orderBy?: CalendarEventOrderByWithRelationInput | CalendarEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CalendarEvents.
     */
    cursor?: CalendarEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CalendarEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CalendarEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CalendarEvents.
     */
    distinct?: CalendarEventScalarFieldEnum | CalendarEventScalarFieldEnum[]
  }

  /**
   * CalendarEvent create
   */
  export type CalendarEventCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    /**
     * The data needed to create a CalendarEvent.
     */
    data: XOR<CalendarEventCreateInput, CalendarEventUncheckedCreateInput>
  }

  /**
   * CalendarEvent createMany
   */
  export type CalendarEventCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CalendarEvents.
     */
    data: CalendarEventCreateManyInput | CalendarEventCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CalendarEvent createManyAndReturn
   */
  export type CalendarEventCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * The data used to create many CalendarEvents.
     */
    data: CalendarEventCreateManyInput | CalendarEventCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CalendarEvent update
   */
  export type CalendarEventUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    /**
     * The data needed to update a CalendarEvent.
     */
    data: XOR<CalendarEventUpdateInput, CalendarEventUncheckedUpdateInput>
    /**
     * Choose, which CalendarEvent to update.
     */
    where: CalendarEventWhereUniqueInput
  }

  /**
   * CalendarEvent updateMany
   */
  export type CalendarEventUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CalendarEvents.
     */
    data: XOR<CalendarEventUpdateManyMutationInput, CalendarEventUncheckedUpdateManyInput>
    /**
     * Filter which CalendarEvents to update
     */
    where?: CalendarEventWhereInput
    /**
     * Limit how many CalendarEvents to update.
     */
    limit?: number
  }

  /**
   * CalendarEvent updateManyAndReturn
   */
  export type CalendarEventUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * The data used to update CalendarEvents.
     */
    data: XOR<CalendarEventUpdateManyMutationInput, CalendarEventUncheckedUpdateManyInput>
    /**
     * Filter which CalendarEvents to update
     */
    where?: CalendarEventWhereInput
    /**
     * Limit how many CalendarEvents to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * CalendarEvent upsert
   */
  export type CalendarEventUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    /**
     * The filter to search for the CalendarEvent to update in case it exists.
     */
    where: CalendarEventWhereUniqueInput
    /**
     * In case the CalendarEvent found by the `where` argument doesn't exist, create a new CalendarEvent with this data.
     */
    create: XOR<CalendarEventCreateInput, CalendarEventUncheckedCreateInput>
    /**
     * In case the CalendarEvent was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CalendarEventUpdateInput, CalendarEventUncheckedUpdateInput>
  }

  /**
   * CalendarEvent delete
   */
  export type CalendarEventDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    /**
     * Filter which CalendarEvent to delete.
     */
    where: CalendarEventWhereUniqueInput
  }

  /**
   * CalendarEvent deleteMany
   */
  export type CalendarEventDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CalendarEvents to delete
     */
    where?: CalendarEventWhereInput
    /**
     * Limit how many CalendarEvents to delete.
     */
    limit?: number
  }

  /**
   * CalendarEvent.diary_entry
   */
  export type CalendarEvent$diary_entryArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    where?: DiaryEntryWhereInput
  }

  /**
   * CalendarEvent without action
   */
  export type CalendarEventDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
  }


  /**
   * Model Summary
   */

  export type AggregateSummary = {
    _count: SummaryCountAggregateOutputType | null
    _min: SummaryMinAggregateOutputType | null
    _max: SummaryMaxAggregateOutputType | null
  }

  export type SummaryMinAggregateOutputType = {
    id: string | null
    user_id: string | null
    summary_type: string | null
    period_start: Date | null
    period_end: Date | null
    content: string | null
    created_at: Date | null
  }

  export type SummaryMaxAggregateOutputType = {
    id: string | null
    user_id: string | null
    summary_type: string | null
    period_start: Date | null
    period_end: Date | null
    content: string | null
    created_at: Date | null
  }

  export type SummaryCountAggregateOutputType = {
    id: number
    user_id: number
    summary_type: number
    period_start: number
    period_end: number
    content: number
    created_at: number
    _all: number
  }


  export type SummaryMinAggregateInputType = {
    id?: true
    user_id?: true
    summary_type?: true
    period_start?: true
    period_end?: true
    content?: true
    created_at?: true
  }

  export type SummaryMaxAggregateInputType = {
    id?: true
    user_id?: true
    summary_type?: true
    period_start?: true
    period_end?: true
    content?: true
    created_at?: true
  }

  export type SummaryCountAggregateInputType = {
    id?: true
    user_id?: true
    summary_type?: true
    period_start?: true
    period_end?: true
    content?: true
    created_at?: true
    _all?: true
  }

  export type SummaryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Summary to aggregate.
     */
    where?: SummaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Summaries to fetch.
     */
    orderBy?: SummaryOrderByWithRelationInput | SummaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SummaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Summaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Summaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Summaries
    **/
    _count?: true | SummaryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SummaryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SummaryMaxAggregateInputType
  }

  export type GetSummaryAggregateType<T extends SummaryAggregateArgs> = {
        [P in keyof T & keyof AggregateSummary]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSummary[P]>
      : GetScalarType<T[P], AggregateSummary[P]>
  }




  export type SummaryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SummaryWhereInput
    orderBy?: SummaryOrderByWithAggregationInput | SummaryOrderByWithAggregationInput[]
    by: SummaryScalarFieldEnum[] | SummaryScalarFieldEnum
    having?: SummaryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SummaryCountAggregateInputType | true
    _min?: SummaryMinAggregateInputType
    _max?: SummaryMaxAggregateInputType
  }

  export type SummaryGroupByOutputType = {
    id: string
    user_id: string
    summary_type: string
    period_start: Date
    period_end: Date
    content: string
    created_at: Date
    _count: SummaryCountAggregateOutputType | null
    _min: SummaryMinAggregateOutputType | null
    _max: SummaryMaxAggregateOutputType | null
  }

  type GetSummaryGroupByPayload<T extends SummaryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SummaryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SummaryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SummaryGroupByOutputType[P]>
            : GetScalarType<T[P], SummaryGroupByOutputType[P]>
        }
      >
    >


  export type SummarySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    summary_type?: boolean
    period_start?: boolean
    period_end?: boolean
    content?: boolean
    created_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["summary"]>

  export type SummarySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    summary_type?: boolean
    period_start?: boolean
    period_end?: boolean
    content?: boolean
    created_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["summary"]>

  export type SummarySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    summary_type?: boolean
    period_start?: boolean
    period_end?: boolean
    content?: boolean
    created_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["summary"]>

  export type SummarySelectScalar = {
    id?: boolean
    user_id?: boolean
    summary_type?: boolean
    period_start?: boolean
    period_end?: boolean
    content?: boolean
    created_at?: boolean
  }

  export type SummaryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "user_id" | "summary_type" | "period_start" | "period_end" | "content" | "created_at", ExtArgs["result"]["summary"]>
  export type SummaryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SummaryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SummaryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $SummaryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Summary"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      user_id: string
      summary_type: string
      period_start: Date
      period_end: Date
      content: string
      created_at: Date
    }, ExtArgs["result"]["summary"]>
    composites: {}
  }

  type SummaryGetPayload<S extends boolean | null | undefined | SummaryDefaultArgs> = $Result.GetResult<Prisma.$SummaryPayload, S>

  type SummaryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SummaryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SummaryCountAggregateInputType | true
    }

  export interface SummaryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Summary'], meta: { name: 'Summary' } }
    /**
     * Find zero or one Summary that matches the filter.
     * @param {SummaryFindUniqueArgs} args - Arguments to find a Summary
     * @example
     * // Get one Summary
     * const summary = await prisma.summary.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SummaryFindUniqueArgs>(args: SelectSubset<T, SummaryFindUniqueArgs<ExtArgs>>): Prisma__SummaryClient<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Summary that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SummaryFindUniqueOrThrowArgs} args - Arguments to find a Summary
     * @example
     * // Get one Summary
     * const summary = await prisma.summary.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SummaryFindUniqueOrThrowArgs>(args: SelectSubset<T, SummaryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SummaryClient<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Summary that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SummaryFindFirstArgs} args - Arguments to find a Summary
     * @example
     * // Get one Summary
     * const summary = await prisma.summary.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SummaryFindFirstArgs>(args?: SelectSubset<T, SummaryFindFirstArgs<ExtArgs>>): Prisma__SummaryClient<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Summary that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SummaryFindFirstOrThrowArgs} args - Arguments to find a Summary
     * @example
     * // Get one Summary
     * const summary = await prisma.summary.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SummaryFindFirstOrThrowArgs>(args?: SelectSubset<T, SummaryFindFirstOrThrowArgs<ExtArgs>>): Prisma__SummaryClient<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Summaries that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SummaryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Summaries
     * const summaries = await prisma.summary.findMany()
     * 
     * // Get first 10 Summaries
     * const summaries = await prisma.summary.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const summaryWithIdOnly = await prisma.summary.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SummaryFindManyArgs>(args?: SelectSubset<T, SummaryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Summary.
     * @param {SummaryCreateArgs} args - Arguments to create a Summary.
     * @example
     * // Create one Summary
     * const Summary = await prisma.summary.create({
     *   data: {
     *     // ... data to create a Summary
     *   }
     * })
     * 
     */
    create<T extends SummaryCreateArgs>(args: SelectSubset<T, SummaryCreateArgs<ExtArgs>>): Prisma__SummaryClient<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Summaries.
     * @param {SummaryCreateManyArgs} args - Arguments to create many Summaries.
     * @example
     * // Create many Summaries
     * const summary = await prisma.summary.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SummaryCreateManyArgs>(args?: SelectSubset<T, SummaryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Summaries and returns the data saved in the database.
     * @param {SummaryCreateManyAndReturnArgs} args - Arguments to create many Summaries.
     * @example
     * // Create many Summaries
     * const summary = await prisma.summary.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Summaries and only return the `id`
     * const summaryWithIdOnly = await prisma.summary.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SummaryCreateManyAndReturnArgs>(args?: SelectSubset<T, SummaryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Summary.
     * @param {SummaryDeleteArgs} args - Arguments to delete one Summary.
     * @example
     * // Delete one Summary
     * const Summary = await prisma.summary.delete({
     *   where: {
     *     // ... filter to delete one Summary
     *   }
     * })
     * 
     */
    delete<T extends SummaryDeleteArgs>(args: SelectSubset<T, SummaryDeleteArgs<ExtArgs>>): Prisma__SummaryClient<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Summary.
     * @param {SummaryUpdateArgs} args - Arguments to update one Summary.
     * @example
     * // Update one Summary
     * const summary = await prisma.summary.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SummaryUpdateArgs>(args: SelectSubset<T, SummaryUpdateArgs<ExtArgs>>): Prisma__SummaryClient<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Summaries.
     * @param {SummaryDeleteManyArgs} args - Arguments to filter Summaries to delete.
     * @example
     * // Delete a few Summaries
     * const { count } = await prisma.summary.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SummaryDeleteManyArgs>(args?: SelectSubset<T, SummaryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Summaries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SummaryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Summaries
     * const summary = await prisma.summary.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SummaryUpdateManyArgs>(args: SelectSubset<T, SummaryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Summaries and returns the data updated in the database.
     * @param {SummaryUpdateManyAndReturnArgs} args - Arguments to update many Summaries.
     * @example
     * // Update many Summaries
     * const summary = await prisma.summary.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Summaries and only return the `id`
     * const summaryWithIdOnly = await prisma.summary.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SummaryUpdateManyAndReturnArgs>(args: SelectSubset<T, SummaryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Summary.
     * @param {SummaryUpsertArgs} args - Arguments to update or create a Summary.
     * @example
     * // Update or create a Summary
     * const summary = await prisma.summary.upsert({
     *   create: {
     *     // ... data to create a Summary
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Summary we want to update
     *   }
     * })
     */
    upsert<T extends SummaryUpsertArgs>(args: SelectSubset<T, SummaryUpsertArgs<ExtArgs>>): Prisma__SummaryClient<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Summaries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SummaryCountArgs} args - Arguments to filter Summaries to count.
     * @example
     * // Count the number of Summaries
     * const count = await prisma.summary.count({
     *   where: {
     *     // ... the filter for the Summaries we want to count
     *   }
     * })
    **/
    count<T extends SummaryCountArgs>(
      args?: Subset<T, SummaryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SummaryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Summary.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SummaryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SummaryAggregateArgs>(args: Subset<T, SummaryAggregateArgs>): Prisma.PrismaPromise<GetSummaryAggregateType<T>>

    /**
     * Group by Summary.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SummaryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SummaryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SummaryGroupByArgs['orderBy'] }
        : { orderBy?: SummaryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SummaryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSummaryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Summary model
   */
  readonly fields: SummaryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Summary.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SummaryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Summary model
   */
  interface SummaryFieldRefs {
    readonly id: FieldRef<"Summary", 'String'>
    readonly user_id: FieldRef<"Summary", 'String'>
    readonly summary_type: FieldRef<"Summary", 'String'>
    readonly period_start: FieldRef<"Summary", 'DateTime'>
    readonly period_end: FieldRef<"Summary", 'DateTime'>
    readonly content: FieldRef<"Summary", 'String'>
    readonly created_at: FieldRef<"Summary", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Summary findUnique
   */
  export type SummaryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
    /**
     * Filter, which Summary to fetch.
     */
    where: SummaryWhereUniqueInput
  }

  /**
   * Summary findUniqueOrThrow
   */
  export type SummaryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
    /**
     * Filter, which Summary to fetch.
     */
    where: SummaryWhereUniqueInput
  }

  /**
   * Summary findFirst
   */
  export type SummaryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
    /**
     * Filter, which Summary to fetch.
     */
    where?: SummaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Summaries to fetch.
     */
    orderBy?: SummaryOrderByWithRelationInput | SummaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Summaries.
     */
    cursor?: SummaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Summaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Summaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Summaries.
     */
    distinct?: SummaryScalarFieldEnum | SummaryScalarFieldEnum[]
  }

  /**
   * Summary findFirstOrThrow
   */
  export type SummaryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
    /**
     * Filter, which Summary to fetch.
     */
    where?: SummaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Summaries to fetch.
     */
    orderBy?: SummaryOrderByWithRelationInput | SummaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Summaries.
     */
    cursor?: SummaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Summaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Summaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Summaries.
     */
    distinct?: SummaryScalarFieldEnum | SummaryScalarFieldEnum[]
  }

  /**
   * Summary findMany
   */
  export type SummaryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
    /**
     * Filter, which Summaries to fetch.
     */
    where?: SummaryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Summaries to fetch.
     */
    orderBy?: SummaryOrderByWithRelationInput | SummaryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Summaries.
     */
    cursor?: SummaryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Summaries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Summaries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Summaries.
     */
    distinct?: SummaryScalarFieldEnum | SummaryScalarFieldEnum[]
  }

  /**
   * Summary create
   */
  export type SummaryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
    /**
     * The data needed to create a Summary.
     */
    data: XOR<SummaryCreateInput, SummaryUncheckedCreateInput>
  }

  /**
   * Summary createMany
   */
  export type SummaryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Summaries.
     */
    data: SummaryCreateManyInput | SummaryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Summary createManyAndReturn
   */
  export type SummaryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * The data used to create many Summaries.
     */
    data: SummaryCreateManyInput | SummaryCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Summary update
   */
  export type SummaryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
    /**
     * The data needed to update a Summary.
     */
    data: XOR<SummaryUpdateInput, SummaryUncheckedUpdateInput>
    /**
     * Choose, which Summary to update.
     */
    where: SummaryWhereUniqueInput
  }

  /**
   * Summary updateMany
   */
  export type SummaryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Summaries.
     */
    data: XOR<SummaryUpdateManyMutationInput, SummaryUncheckedUpdateManyInput>
    /**
     * Filter which Summaries to update
     */
    where?: SummaryWhereInput
    /**
     * Limit how many Summaries to update.
     */
    limit?: number
  }

  /**
   * Summary updateManyAndReturn
   */
  export type SummaryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * The data used to update Summaries.
     */
    data: XOR<SummaryUpdateManyMutationInput, SummaryUncheckedUpdateManyInput>
    /**
     * Filter which Summaries to update
     */
    where?: SummaryWhereInput
    /**
     * Limit how many Summaries to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Summary upsert
   */
  export type SummaryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
    /**
     * The filter to search for the Summary to update in case it exists.
     */
    where: SummaryWhereUniqueInput
    /**
     * In case the Summary found by the `where` argument doesn't exist, create a new Summary with this data.
     */
    create: XOR<SummaryCreateInput, SummaryUncheckedCreateInput>
    /**
     * In case the Summary was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SummaryUpdateInput, SummaryUncheckedUpdateInput>
  }

  /**
   * Summary delete
   */
  export type SummaryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
    /**
     * Filter which Summary to delete.
     */
    where: SummaryWhereUniqueInput
  }

  /**
   * Summary deleteMany
   */
  export type SummaryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Summaries to delete
     */
    where?: SummaryWhereInput
    /**
     * Limit how many Summaries to delete.
     */
    limit?: number
  }

  /**
   * Summary without action
   */
  export type SummaryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
  }


  /**
   * Model EntityMention
   */

  export type AggregateEntityMention = {
    _count: EntityMentionCountAggregateOutputType | null
    _min: EntityMentionMinAggregateOutputType | null
    _max: EntityMentionMaxAggregateOutputType | null
  }

  export type EntityMentionMinAggregateOutputType = {
    id: string | null
    chunk_id: string | null
    entity_type: string | null
    entity_value: string | null
    created_at: Date | null
  }

  export type EntityMentionMaxAggregateOutputType = {
    id: string | null
    chunk_id: string | null
    entity_type: string | null
    entity_value: string | null
    created_at: Date | null
  }

  export type EntityMentionCountAggregateOutputType = {
    id: number
    chunk_id: number
    entity_type: number
    entity_value: number
    created_at: number
    _all: number
  }


  export type EntityMentionMinAggregateInputType = {
    id?: true
    chunk_id?: true
    entity_type?: true
    entity_value?: true
    created_at?: true
  }

  export type EntityMentionMaxAggregateInputType = {
    id?: true
    chunk_id?: true
    entity_type?: true
    entity_value?: true
    created_at?: true
  }

  export type EntityMentionCountAggregateInputType = {
    id?: true
    chunk_id?: true
    entity_type?: true
    entity_value?: true
    created_at?: true
    _all?: true
  }

  export type EntityMentionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which EntityMention to aggregate.
     */
    where?: EntityMentionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EntityMentions to fetch.
     */
    orderBy?: EntityMentionOrderByWithRelationInput | EntityMentionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EntityMentionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EntityMentions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EntityMentions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned EntityMentions
    **/
    _count?: true | EntityMentionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EntityMentionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EntityMentionMaxAggregateInputType
  }

  export type GetEntityMentionAggregateType<T extends EntityMentionAggregateArgs> = {
        [P in keyof T & keyof AggregateEntityMention]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEntityMention[P]>
      : GetScalarType<T[P], AggregateEntityMention[P]>
  }




  export type EntityMentionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EntityMentionWhereInput
    orderBy?: EntityMentionOrderByWithAggregationInput | EntityMentionOrderByWithAggregationInput[]
    by: EntityMentionScalarFieldEnum[] | EntityMentionScalarFieldEnum
    having?: EntityMentionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EntityMentionCountAggregateInputType | true
    _min?: EntityMentionMinAggregateInputType
    _max?: EntityMentionMaxAggregateInputType
  }

  export type EntityMentionGroupByOutputType = {
    id: string
    chunk_id: string
    entity_type: string
    entity_value: string
    created_at: Date
    _count: EntityMentionCountAggregateOutputType | null
    _min: EntityMentionMinAggregateOutputType | null
    _max: EntityMentionMaxAggregateOutputType | null
  }

  type GetEntityMentionGroupByPayload<T extends EntityMentionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EntityMentionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EntityMentionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EntityMentionGroupByOutputType[P]>
            : GetScalarType<T[P], EntityMentionGroupByOutputType[P]>
        }
      >
    >


  export type EntityMentionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    chunk_id?: boolean
    entity_type?: boolean
    entity_value?: boolean
    created_at?: boolean
    chunk?: boolean | MemoryChunkDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["entityMention"]>

  export type EntityMentionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    chunk_id?: boolean
    entity_type?: boolean
    entity_value?: boolean
    created_at?: boolean
    chunk?: boolean | MemoryChunkDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["entityMention"]>

  export type EntityMentionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    chunk_id?: boolean
    entity_type?: boolean
    entity_value?: boolean
    created_at?: boolean
    chunk?: boolean | MemoryChunkDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["entityMention"]>

  export type EntityMentionSelectScalar = {
    id?: boolean
    chunk_id?: boolean
    entity_type?: boolean
    entity_value?: boolean
    created_at?: boolean
  }

  export type EntityMentionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "chunk_id" | "entity_type" | "entity_value" | "created_at", ExtArgs["result"]["entityMention"]>
  export type EntityMentionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    chunk?: boolean | MemoryChunkDefaultArgs<ExtArgs>
  }
  export type EntityMentionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    chunk?: boolean | MemoryChunkDefaultArgs<ExtArgs>
  }
  export type EntityMentionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    chunk?: boolean | MemoryChunkDefaultArgs<ExtArgs>
  }

  export type $EntityMentionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "EntityMention"
    objects: {
      chunk: Prisma.$MemoryChunkPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      chunk_id: string
      entity_type: string
      entity_value: string
      created_at: Date
    }, ExtArgs["result"]["entityMention"]>
    composites: {}
  }

  type EntityMentionGetPayload<S extends boolean | null | undefined | EntityMentionDefaultArgs> = $Result.GetResult<Prisma.$EntityMentionPayload, S>

  type EntityMentionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<EntityMentionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: EntityMentionCountAggregateInputType | true
    }

  export interface EntityMentionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['EntityMention'], meta: { name: 'EntityMention' } }
    /**
     * Find zero or one EntityMention that matches the filter.
     * @param {EntityMentionFindUniqueArgs} args - Arguments to find a EntityMention
     * @example
     * // Get one EntityMention
     * const entityMention = await prisma.entityMention.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EntityMentionFindUniqueArgs>(args: SelectSubset<T, EntityMentionFindUniqueArgs<ExtArgs>>): Prisma__EntityMentionClient<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one EntityMention that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {EntityMentionFindUniqueOrThrowArgs} args - Arguments to find a EntityMention
     * @example
     * // Get one EntityMention
     * const entityMention = await prisma.entityMention.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EntityMentionFindUniqueOrThrowArgs>(args: SelectSubset<T, EntityMentionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__EntityMentionClient<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first EntityMention that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EntityMentionFindFirstArgs} args - Arguments to find a EntityMention
     * @example
     * // Get one EntityMention
     * const entityMention = await prisma.entityMention.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EntityMentionFindFirstArgs>(args?: SelectSubset<T, EntityMentionFindFirstArgs<ExtArgs>>): Prisma__EntityMentionClient<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first EntityMention that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EntityMentionFindFirstOrThrowArgs} args - Arguments to find a EntityMention
     * @example
     * // Get one EntityMention
     * const entityMention = await prisma.entityMention.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EntityMentionFindFirstOrThrowArgs>(args?: SelectSubset<T, EntityMentionFindFirstOrThrowArgs<ExtArgs>>): Prisma__EntityMentionClient<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more EntityMentions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EntityMentionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all EntityMentions
     * const entityMentions = await prisma.entityMention.findMany()
     * 
     * // Get first 10 EntityMentions
     * const entityMentions = await prisma.entityMention.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const entityMentionWithIdOnly = await prisma.entityMention.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends EntityMentionFindManyArgs>(args?: SelectSubset<T, EntityMentionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a EntityMention.
     * @param {EntityMentionCreateArgs} args - Arguments to create a EntityMention.
     * @example
     * // Create one EntityMention
     * const EntityMention = await prisma.entityMention.create({
     *   data: {
     *     // ... data to create a EntityMention
     *   }
     * })
     * 
     */
    create<T extends EntityMentionCreateArgs>(args: SelectSubset<T, EntityMentionCreateArgs<ExtArgs>>): Prisma__EntityMentionClient<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many EntityMentions.
     * @param {EntityMentionCreateManyArgs} args - Arguments to create many EntityMentions.
     * @example
     * // Create many EntityMentions
     * const entityMention = await prisma.entityMention.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends EntityMentionCreateManyArgs>(args?: SelectSubset<T, EntityMentionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many EntityMentions and returns the data saved in the database.
     * @param {EntityMentionCreateManyAndReturnArgs} args - Arguments to create many EntityMentions.
     * @example
     * // Create many EntityMentions
     * const entityMention = await prisma.entityMention.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many EntityMentions and only return the `id`
     * const entityMentionWithIdOnly = await prisma.entityMention.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends EntityMentionCreateManyAndReturnArgs>(args?: SelectSubset<T, EntityMentionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a EntityMention.
     * @param {EntityMentionDeleteArgs} args - Arguments to delete one EntityMention.
     * @example
     * // Delete one EntityMention
     * const EntityMention = await prisma.entityMention.delete({
     *   where: {
     *     // ... filter to delete one EntityMention
     *   }
     * })
     * 
     */
    delete<T extends EntityMentionDeleteArgs>(args: SelectSubset<T, EntityMentionDeleteArgs<ExtArgs>>): Prisma__EntityMentionClient<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one EntityMention.
     * @param {EntityMentionUpdateArgs} args - Arguments to update one EntityMention.
     * @example
     * // Update one EntityMention
     * const entityMention = await prisma.entityMention.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends EntityMentionUpdateArgs>(args: SelectSubset<T, EntityMentionUpdateArgs<ExtArgs>>): Prisma__EntityMentionClient<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more EntityMentions.
     * @param {EntityMentionDeleteManyArgs} args - Arguments to filter EntityMentions to delete.
     * @example
     * // Delete a few EntityMentions
     * const { count } = await prisma.entityMention.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends EntityMentionDeleteManyArgs>(args?: SelectSubset<T, EntityMentionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more EntityMentions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EntityMentionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many EntityMentions
     * const entityMention = await prisma.entityMention.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends EntityMentionUpdateManyArgs>(args: SelectSubset<T, EntityMentionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more EntityMentions and returns the data updated in the database.
     * @param {EntityMentionUpdateManyAndReturnArgs} args - Arguments to update many EntityMentions.
     * @example
     * // Update many EntityMentions
     * const entityMention = await prisma.entityMention.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more EntityMentions and only return the `id`
     * const entityMentionWithIdOnly = await prisma.entityMention.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends EntityMentionUpdateManyAndReturnArgs>(args: SelectSubset<T, EntityMentionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one EntityMention.
     * @param {EntityMentionUpsertArgs} args - Arguments to update or create a EntityMention.
     * @example
     * // Update or create a EntityMention
     * const entityMention = await prisma.entityMention.upsert({
     *   create: {
     *     // ... data to create a EntityMention
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the EntityMention we want to update
     *   }
     * })
     */
    upsert<T extends EntityMentionUpsertArgs>(args: SelectSubset<T, EntityMentionUpsertArgs<ExtArgs>>): Prisma__EntityMentionClient<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of EntityMentions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EntityMentionCountArgs} args - Arguments to filter EntityMentions to count.
     * @example
     * // Count the number of EntityMentions
     * const count = await prisma.entityMention.count({
     *   where: {
     *     // ... the filter for the EntityMentions we want to count
     *   }
     * })
    **/
    count<T extends EntityMentionCountArgs>(
      args?: Subset<T, EntityMentionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EntityMentionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a EntityMention.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EntityMentionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EntityMentionAggregateArgs>(args: Subset<T, EntityMentionAggregateArgs>): Prisma.PrismaPromise<GetEntityMentionAggregateType<T>>

    /**
     * Group by EntityMention.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EntityMentionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EntityMentionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EntityMentionGroupByArgs['orderBy'] }
        : { orderBy?: EntityMentionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EntityMentionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEntityMentionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the EntityMention model
   */
  readonly fields: EntityMentionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for EntityMention.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EntityMentionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    chunk<T extends MemoryChunkDefaultArgs<ExtArgs> = {}>(args?: Subset<T, MemoryChunkDefaultArgs<ExtArgs>>): Prisma__MemoryChunkClient<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the EntityMention model
   */
  interface EntityMentionFieldRefs {
    readonly id: FieldRef<"EntityMention", 'String'>
    readonly chunk_id: FieldRef<"EntityMention", 'String'>
    readonly entity_type: FieldRef<"EntityMention", 'String'>
    readonly entity_value: FieldRef<"EntityMention", 'String'>
    readonly created_at: FieldRef<"EntityMention", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * EntityMention findUnique
   */
  export type EntityMentionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
    /**
     * Filter, which EntityMention to fetch.
     */
    where: EntityMentionWhereUniqueInput
  }

  /**
   * EntityMention findUniqueOrThrow
   */
  export type EntityMentionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
    /**
     * Filter, which EntityMention to fetch.
     */
    where: EntityMentionWhereUniqueInput
  }

  /**
   * EntityMention findFirst
   */
  export type EntityMentionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
    /**
     * Filter, which EntityMention to fetch.
     */
    where?: EntityMentionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EntityMentions to fetch.
     */
    orderBy?: EntityMentionOrderByWithRelationInput | EntityMentionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EntityMentions.
     */
    cursor?: EntityMentionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EntityMentions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EntityMentions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EntityMentions.
     */
    distinct?: EntityMentionScalarFieldEnum | EntityMentionScalarFieldEnum[]
  }

  /**
   * EntityMention findFirstOrThrow
   */
  export type EntityMentionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
    /**
     * Filter, which EntityMention to fetch.
     */
    where?: EntityMentionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EntityMentions to fetch.
     */
    orderBy?: EntityMentionOrderByWithRelationInput | EntityMentionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EntityMentions.
     */
    cursor?: EntityMentionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EntityMentions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EntityMentions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EntityMentions.
     */
    distinct?: EntityMentionScalarFieldEnum | EntityMentionScalarFieldEnum[]
  }

  /**
   * EntityMention findMany
   */
  export type EntityMentionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
    /**
     * Filter, which EntityMentions to fetch.
     */
    where?: EntityMentionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EntityMentions to fetch.
     */
    orderBy?: EntityMentionOrderByWithRelationInput | EntityMentionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing EntityMentions.
     */
    cursor?: EntityMentionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EntityMentions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EntityMentions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EntityMentions.
     */
    distinct?: EntityMentionScalarFieldEnum | EntityMentionScalarFieldEnum[]
  }

  /**
   * EntityMention create
   */
  export type EntityMentionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
    /**
     * The data needed to create a EntityMention.
     */
    data: XOR<EntityMentionCreateInput, EntityMentionUncheckedCreateInput>
  }

  /**
   * EntityMention createMany
   */
  export type EntityMentionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many EntityMentions.
     */
    data: EntityMentionCreateManyInput | EntityMentionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * EntityMention createManyAndReturn
   */
  export type EntityMentionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * The data used to create many EntityMentions.
     */
    data: EntityMentionCreateManyInput | EntityMentionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * EntityMention update
   */
  export type EntityMentionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
    /**
     * The data needed to update a EntityMention.
     */
    data: XOR<EntityMentionUpdateInput, EntityMentionUncheckedUpdateInput>
    /**
     * Choose, which EntityMention to update.
     */
    where: EntityMentionWhereUniqueInput
  }

  /**
   * EntityMention updateMany
   */
  export type EntityMentionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update EntityMentions.
     */
    data: XOR<EntityMentionUpdateManyMutationInput, EntityMentionUncheckedUpdateManyInput>
    /**
     * Filter which EntityMentions to update
     */
    where?: EntityMentionWhereInput
    /**
     * Limit how many EntityMentions to update.
     */
    limit?: number
  }

  /**
   * EntityMention updateManyAndReturn
   */
  export type EntityMentionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * The data used to update EntityMentions.
     */
    data: XOR<EntityMentionUpdateManyMutationInput, EntityMentionUncheckedUpdateManyInput>
    /**
     * Filter which EntityMentions to update
     */
    where?: EntityMentionWhereInput
    /**
     * Limit how many EntityMentions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * EntityMention upsert
   */
  export type EntityMentionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
    /**
     * The filter to search for the EntityMention to update in case it exists.
     */
    where: EntityMentionWhereUniqueInput
    /**
     * In case the EntityMention found by the `where` argument doesn't exist, create a new EntityMention with this data.
     */
    create: XOR<EntityMentionCreateInput, EntityMentionUncheckedCreateInput>
    /**
     * In case the EntityMention was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EntityMentionUpdateInput, EntityMentionUncheckedUpdateInput>
  }

  /**
   * EntityMention delete
   */
  export type EntityMentionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
    /**
     * Filter which EntityMention to delete.
     */
    where: EntityMentionWhereUniqueInput
  }

  /**
   * EntityMention deleteMany
   */
  export type EntityMentionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which EntityMentions to delete
     */
    where?: EntityMentionWhereInput
    /**
     * Limit how many EntityMentions to delete.
     */
    limit?: number
  }

  /**
   * EntityMention without action
   */
  export type EntityMentionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
  }


  /**
   * Model GmailMessage
   */

  export type AggregateGmailMessage = {
    _count: GmailMessageCountAggregateOutputType | null
    _min: GmailMessageMinAggregateOutputType | null
    _max: GmailMessageMaxAggregateOutputType | null
  }

  export type GmailMessageMinAggregateOutputType = {
    id: string | null
    user_id: string | null
    external_id: string | null
    sender: string | null
    subject: string | null
    body: string | null
    created_at: Date | null
  }

  export type GmailMessageMaxAggregateOutputType = {
    id: string | null
    user_id: string | null
    external_id: string | null
    sender: string | null
    subject: string | null
    body: string | null
    created_at: Date | null
  }

  export type GmailMessageCountAggregateOutputType = {
    id: number
    user_id: number
    external_id: number
    sender: number
    subject: number
    body: number
    created_at: number
    _all: number
  }


  export type GmailMessageMinAggregateInputType = {
    id?: true
    user_id?: true
    external_id?: true
    sender?: true
    subject?: true
    body?: true
    created_at?: true
  }

  export type GmailMessageMaxAggregateInputType = {
    id?: true
    user_id?: true
    external_id?: true
    sender?: true
    subject?: true
    body?: true
    created_at?: true
  }

  export type GmailMessageCountAggregateInputType = {
    id?: true
    user_id?: true
    external_id?: true
    sender?: true
    subject?: true
    body?: true
    created_at?: true
    _all?: true
  }

  export type GmailMessageAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GmailMessage to aggregate.
     */
    where?: GmailMessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GmailMessages to fetch.
     */
    orderBy?: GmailMessageOrderByWithRelationInput | GmailMessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: GmailMessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GmailMessages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GmailMessages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned GmailMessages
    **/
    _count?: true | GmailMessageCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: GmailMessageMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: GmailMessageMaxAggregateInputType
  }

  export type GetGmailMessageAggregateType<T extends GmailMessageAggregateArgs> = {
        [P in keyof T & keyof AggregateGmailMessage]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGmailMessage[P]>
      : GetScalarType<T[P], AggregateGmailMessage[P]>
  }




  export type GmailMessageGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: GmailMessageWhereInput
    orderBy?: GmailMessageOrderByWithAggregationInput | GmailMessageOrderByWithAggregationInput[]
    by: GmailMessageScalarFieldEnum[] | GmailMessageScalarFieldEnum
    having?: GmailMessageScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: GmailMessageCountAggregateInputType | true
    _min?: GmailMessageMinAggregateInputType
    _max?: GmailMessageMaxAggregateInputType
  }

  export type GmailMessageGroupByOutputType = {
    id: string
    user_id: string
    external_id: string
    sender: string
    subject: string
    body: string
    created_at: Date
    _count: GmailMessageCountAggregateOutputType | null
    _min: GmailMessageMinAggregateOutputType | null
    _max: GmailMessageMaxAggregateOutputType | null
  }

  type GetGmailMessageGroupByPayload<T extends GmailMessageGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<GmailMessageGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof GmailMessageGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], GmailMessageGroupByOutputType[P]>
            : GetScalarType<T[P], GmailMessageGroupByOutputType[P]>
        }
      >
    >


  export type GmailMessageSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    external_id?: boolean
    sender?: boolean
    subject?: boolean
    body?: boolean
    created_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["gmailMessage"]>

  export type GmailMessageSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    external_id?: boolean
    sender?: boolean
    subject?: boolean
    body?: boolean
    created_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["gmailMessage"]>

  export type GmailMessageSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    external_id?: boolean
    sender?: boolean
    subject?: boolean
    body?: boolean
    created_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["gmailMessage"]>

  export type GmailMessageSelectScalar = {
    id?: boolean
    user_id?: boolean
    external_id?: boolean
    sender?: boolean
    subject?: boolean
    body?: boolean
    created_at?: boolean
  }

  export type GmailMessageOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "user_id" | "external_id" | "sender" | "subject" | "body" | "created_at", ExtArgs["result"]["gmailMessage"]>
  export type GmailMessageInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type GmailMessageIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type GmailMessageIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $GmailMessagePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "GmailMessage"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      user_id: string
      external_id: string
      sender: string
      subject: string
      body: string
      created_at: Date
    }, ExtArgs["result"]["gmailMessage"]>
    composites: {}
  }

  type GmailMessageGetPayload<S extends boolean | null | undefined | GmailMessageDefaultArgs> = $Result.GetResult<Prisma.$GmailMessagePayload, S>

  type GmailMessageCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<GmailMessageFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: GmailMessageCountAggregateInputType | true
    }

  export interface GmailMessageDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['GmailMessage'], meta: { name: 'GmailMessage' } }
    /**
     * Find zero or one GmailMessage that matches the filter.
     * @param {GmailMessageFindUniqueArgs} args - Arguments to find a GmailMessage
     * @example
     * // Get one GmailMessage
     * const gmailMessage = await prisma.gmailMessage.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends GmailMessageFindUniqueArgs>(args: SelectSubset<T, GmailMessageFindUniqueArgs<ExtArgs>>): Prisma__GmailMessageClient<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one GmailMessage that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {GmailMessageFindUniqueOrThrowArgs} args - Arguments to find a GmailMessage
     * @example
     * // Get one GmailMessage
     * const gmailMessage = await prisma.gmailMessage.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends GmailMessageFindUniqueOrThrowArgs>(args: SelectSubset<T, GmailMessageFindUniqueOrThrowArgs<ExtArgs>>): Prisma__GmailMessageClient<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GmailMessage that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GmailMessageFindFirstArgs} args - Arguments to find a GmailMessage
     * @example
     * // Get one GmailMessage
     * const gmailMessage = await prisma.gmailMessage.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends GmailMessageFindFirstArgs>(args?: SelectSubset<T, GmailMessageFindFirstArgs<ExtArgs>>): Prisma__GmailMessageClient<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GmailMessage that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GmailMessageFindFirstOrThrowArgs} args - Arguments to find a GmailMessage
     * @example
     * // Get one GmailMessage
     * const gmailMessage = await prisma.gmailMessage.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends GmailMessageFindFirstOrThrowArgs>(args?: SelectSubset<T, GmailMessageFindFirstOrThrowArgs<ExtArgs>>): Prisma__GmailMessageClient<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more GmailMessages that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GmailMessageFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all GmailMessages
     * const gmailMessages = await prisma.gmailMessage.findMany()
     * 
     * // Get first 10 GmailMessages
     * const gmailMessages = await prisma.gmailMessage.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const gmailMessageWithIdOnly = await prisma.gmailMessage.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends GmailMessageFindManyArgs>(args?: SelectSubset<T, GmailMessageFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a GmailMessage.
     * @param {GmailMessageCreateArgs} args - Arguments to create a GmailMessage.
     * @example
     * // Create one GmailMessage
     * const GmailMessage = await prisma.gmailMessage.create({
     *   data: {
     *     // ... data to create a GmailMessage
     *   }
     * })
     * 
     */
    create<T extends GmailMessageCreateArgs>(args: SelectSubset<T, GmailMessageCreateArgs<ExtArgs>>): Prisma__GmailMessageClient<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many GmailMessages.
     * @param {GmailMessageCreateManyArgs} args - Arguments to create many GmailMessages.
     * @example
     * // Create many GmailMessages
     * const gmailMessage = await prisma.gmailMessage.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends GmailMessageCreateManyArgs>(args?: SelectSubset<T, GmailMessageCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many GmailMessages and returns the data saved in the database.
     * @param {GmailMessageCreateManyAndReturnArgs} args - Arguments to create many GmailMessages.
     * @example
     * // Create many GmailMessages
     * const gmailMessage = await prisma.gmailMessage.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many GmailMessages and only return the `id`
     * const gmailMessageWithIdOnly = await prisma.gmailMessage.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends GmailMessageCreateManyAndReturnArgs>(args?: SelectSubset<T, GmailMessageCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a GmailMessage.
     * @param {GmailMessageDeleteArgs} args - Arguments to delete one GmailMessage.
     * @example
     * // Delete one GmailMessage
     * const GmailMessage = await prisma.gmailMessage.delete({
     *   where: {
     *     // ... filter to delete one GmailMessage
     *   }
     * })
     * 
     */
    delete<T extends GmailMessageDeleteArgs>(args: SelectSubset<T, GmailMessageDeleteArgs<ExtArgs>>): Prisma__GmailMessageClient<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one GmailMessage.
     * @param {GmailMessageUpdateArgs} args - Arguments to update one GmailMessage.
     * @example
     * // Update one GmailMessage
     * const gmailMessage = await prisma.gmailMessage.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends GmailMessageUpdateArgs>(args: SelectSubset<T, GmailMessageUpdateArgs<ExtArgs>>): Prisma__GmailMessageClient<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more GmailMessages.
     * @param {GmailMessageDeleteManyArgs} args - Arguments to filter GmailMessages to delete.
     * @example
     * // Delete a few GmailMessages
     * const { count } = await prisma.gmailMessage.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends GmailMessageDeleteManyArgs>(args?: SelectSubset<T, GmailMessageDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GmailMessages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GmailMessageUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many GmailMessages
     * const gmailMessage = await prisma.gmailMessage.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends GmailMessageUpdateManyArgs>(args: SelectSubset<T, GmailMessageUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GmailMessages and returns the data updated in the database.
     * @param {GmailMessageUpdateManyAndReturnArgs} args - Arguments to update many GmailMessages.
     * @example
     * // Update many GmailMessages
     * const gmailMessage = await prisma.gmailMessage.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more GmailMessages and only return the `id`
     * const gmailMessageWithIdOnly = await prisma.gmailMessage.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends GmailMessageUpdateManyAndReturnArgs>(args: SelectSubset<T, GmailMessageUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one GmailMessage.
     * @param {GmailMessageUpsertArgs} args - Arguments to update or create a GmailMessage.
     * @example
     * // Update or create a GmailMessage
     * const gmailMessage = await prisma.gmailMessage.upsert({
     *   create: {
     *     // ... data to create a GmailMessage
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the GmailMessage we want to update
     *   }
     * })
     */
    upsert<T extends GmailMessageUpsertArgs>(args: SelectSubset<T, GmailMessageUpsertArgs<ExtArgs>>): Prisma__GmailMessageClient<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of GmailMessages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GmailMessageCountArgs} args - Arguments to filter GmailMessages to count.
     * @example
     * // Count the number of GmailMessages
     * const count = await prisma.gmailMessage.count({
     *   where: {
     *     // ... the filter for the GmailMessages we want to count
     *   }
     * })
    **/
    count<T extends GmailMessageCountArgs>(
      args?: Subset<T, GmailMessageCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], GmailMessageCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a GmailMessage.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GmailMessageAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends GmailMessageAggregateArgs>(args: Subset<T, GmailMessageAggregateArgs>): Prisma.PrismaPromise<GetGmailMessageAggregateType<T>>

    /**
     * Group by GmailMessage.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GmailMessageGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends GmailMessageGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: GmailMessageGroupByArgs['orderBy'] }
        : { orderBy?: GmailMessageGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, GmailMessageGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGmailMessageGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the GmailMessage model
   */
  readonly fields: GmailMessageFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for GmailMessage.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__GmailMessageClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the GmailMessage model
   */
  interface GmailMessageFieldRefs {
    readonly id: FieldRef<"GmailMessage", 'String'>
    readonly user_id: FieldRef<"GmailMessage", 'String'>
    readonly external_id: FieldRef<"GmailMessage", 'String'>
    readonly sender: FieldRef<"GmailMessage", 'String'>
    readonly subject: FieldRef<"GmailMessage", 'String'>
    readonly body: FieldRef<"GmailMessage", 'String'>
    readonly created_at: FieldRef<"GmailMessage", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * GmailMessage findUnique
   */
  export type GmailMessageFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
    /**
     * Filter, which GmailMessage to fetch.
     */
    where: GmailMessageWhereUniqueInput
  }

  /**
   * GmailMessage findUniqueOrThrow
   */
  export type GmailMessageFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
    /**
     * Filter, which GmailMessage to fetch.
     */
    where: GmailMessageWhereUniqueInput
  }

  /**
   * GmailMessage findFirst
   */
  export type GmailMessageFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
    /**
     * Filter, which GmailMessage to fetch.
     */
    where?: GmailMessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GmailMessages to fetch.
     */
    orderBy?: GmailMessageOrderByWithRelationInput | GmailMessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GmailMessages.
     */
    cursor?: GmailMessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GmailMessages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GmailMessages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GmailMessages.
     */
    distinct?: GmailMessageScalarFieldEnum | GmailMessageScalarFieldEnum[]
  }

  /**
   * GmailMessage findFirstOrThrow
   */
  export type GmailMessageFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
    /**
     * Filter, which GmailMessage to fetch.
     */
    where?: GmailMessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GmailMessages to fetch.
     */
    orderBy?: GmailMessageOrderByWithRelationInput | GmailMessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GmailMessages.
     */
    cursor?: GmailMessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GmailMessages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GmailMessages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GmailMessages.
     */
    distinct?: GmailMessageScalarFieldEnum | GmailMessageScalarFieldEnum[]
  }

  /**
   * GmailMessage findMany
   */
  export type GmailMessageFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
    /**
     * Filter, which GmailMessages to fetch.
     */
    where?: GmailMessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GmailMessages to fetch.
     */
    orderBy?: GmailMessageOrderByWithRelationInput | GmailMessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing GmailMessages.
     */
    cursor?: GmailMessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GmailMessages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GmailMessages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GmailMessages.
     */
    distinct?: GmailMessageScalarFieldEnum | GmailMessageScalarFieldEnum[]
  }

  /**
   * GmailMessage create
   */
  export type GmailMessageCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
    /**
     * The data needed to create a GmailMessage.
     */
    data: XOR<GmailMessageCreateInput, GmailMessageUncheckedCreateInput>
  }

  /**
   * GmailMessage createMany
   */
  export type GmailMessageCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many GmailMessages.
     */
    data: GmailMessageCreateManyInput | GmailMessageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * GmailMessage createManyAndReturn
   */
  export type GmailMessageCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * The data used to create many GmailMessages.
     */
    data: GmailMessageCreateManyInput | GmailMessageCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * GmailMessage update
   */
  export type GmailMessageUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
    /**
     * The data needed to update a GmailMessage.
     */
    data: XOR<GmailMessageUpdateInput, GmailMessageUncheckedUpdateInput>
    /**
     * Choose, which GmailMessage to update.
     */
    where: GmailMessageWhereUniqueInput
  }

  /**
   * GmailMessage updateMany
   */
  export type GmailMessageUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update GmailMessages.
     */
    data: XOR<GmailMessageUpdateManyMutationInput, GmailMessageUncheckedUpdateManyInput>
    /**
     * Filter which GmailMessages to update
     */
    where?: GmailMessageWhereInput
    /**
     * Limit how many GmailMessages to update.
     */
    limit?: number
  }

  /**
   * GmailMessage updateManyAndReturn
   */
  export type GmailMessageUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * The data used to update GmailMessages.
     */
    data: XOR<GmailMessageUpdateManyMutationInput, GmailMessageUncheckedUpdateManyInput>
    /**
     * Filter which GmailMessages to update
     */
    where?: GmailMessageWhereInput
    /**
     * Limit how many GmailMessages to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * GmailMessage upsert
   */
  export type GmailMessageUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
    /**
     * The filter to search for the GmailMessage to update in case it exists.
     */
    where: GmailMessageWhereUniqueInput
    /**
     * In case the GmailMessage found by the `where` argument doesn't exist, create a new GmailMessage with this data.
     */
    create: XOR<GmailMessageCreateInput, GmailMessageUncheckedCreateInput>
    /**
     * In case the GmailMessage was found with the provided `where` argument, update it with this data.
     */
    update: XOR<GmailMessageUpdateInput, GmailMessageUncheckedUpdateInput>
  }

  /**
   * GmailMessage delete
   */
  export type GmailMessageDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
    /**
     * Filter which GmailMessage to delete.
     */
    where: GmailMessageWhereUniqueInput
  }

  /**
   * GmailMessage deleteMany
   */
  export type GmailMessageDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GmailMessages to delete
     */
    where?: GmailMessageWhereInput
    /**
     * Limit how many GmailMessages to delete.
     */
    limit?: number
  }

  /**
   * GmailMessage without action
   */
  export type GmailMessageDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
  }


  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    supabaseId: string | null
    email: string | null
    display_name: string | null
    google_connected: boolean | null
    google_access_token: string | null
    google_refresh_token: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    supabaseId: string | null
    email: string | null
    display_name: string | null
    google_connected: boolean | null
    google_access_token: string | null
    google_refresh_token: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    supabaseId: number
    email: number
    display_name: number
    google_connected: number
    google_access_token: number
    google_refresh_token: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    supabaseId?: true
    email?: true
    display_name?: true
    google_connected?: true
    google_access_token?: true
    google_refresh_token?: true
    created_at?: true
    updated_at?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    supabaseId?: true
    email?: true
    display_name?: true
    google_connected?: true
    google_access_token?: true
    google_refresh_token?: true
    created_at?: true
    updated_at?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    supabaseId?: true
    email?: true
    display_name?: true
    google_connected?: true
    google_access_token?: true
    google_refresh_token?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    supabaseId: string
    email: string
    display_name: string | null
    google_connected: boolean
    google_access_token: string | null
    google_refresh_token: string | null
    created_at: Date
    updated_at: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    supabaseId?: boolean
    email?: boolean
    display_name?: boolean
    google_connected?: boolean
    google_access_token?: boolean
    google_refresh_token?: boolean
    created_at?: boolean
    updated_at?: boolean
    diary_entries?: boolean | User$diary_entriesArgs<ExtArgs>
    memory_chunks?: boolean | User$memory_chunksArgs<ExtArgs>
    summaries?: boolean | User$summariesArgs<ExtArgs>
    calendar_events?: boolean | User$calendar_eventsArgs<ExtArgs>
    gmail_messages?: boolean | User$gmail_messagesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    supabaseId?: boolean
    email?: boolean
    display_name?: boolean
    google_connected?: boolean
    google_access_token?: boolean
    google_refresh_token?: boolean
    created_at?: boolean
    updated_at?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    supabaseId?: boolean
    email?: boolean
    display_name?: boolean
    google_connected?: boolean
    google_access_token?: boolean
    google_refresh_token?: boolean
    created_at?: boolean
    updated_at?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    supabaseId?: boolean
    email?: boolean
    display_name?: boolean
    google_connected?: boolean
    google_access_token?: boolean
    google_refresh_token?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "supabaseId" | "email" | "display_name" | "google_connected" | "google_access_token" | "google_refresh_token" | "created_at" | "updated_at", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    diary_entries?: boolean | User$diary_entriesArgs<ExtArgs>
    memory_chunks?: boolean | User$memory_chunksArgs<ExtArgs>
    summaries?: boolean | User$summariesArgs<ExtArgs>
    calendar_events?: boolean | User$calendar_eventsArgs<ExtArgs>
    gmail_messages?: boolean | User$gmail_messagesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      diary_entries: Prisma.$DiaryEntryPayload<ExtArgs>[]
      memory_chunks: Prisma.$MemoryChunkPayload<ExtArgs>[]
      summaries: Prisma.$SummaryPayload<ExtArgs>[]
      calendar_events: Prisma.$CalendarEventPayload<ExtArgs>[]
      gmail_messages: Prisma.$GmailMessagePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      supabaseId: string
      email: string
      display_name: string | null
      google_connected: boolean
      google_access_token: string | null
      google_refresh_token: string | null
      created_at: Date
      updated_at: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    diary_entries<T extends User$diary_entriesArgs<ExtArgs> = {}>(args?: Subset<T, User$diary_entriesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    memory_chunks<T extends User$memory_chunksArgs<ExtArgs> = {}>(args?: Subset<T, User$memory_chunksArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    summaries<T extends User$summariesArgs<ExtArgs> = {}>(args?: Subset<T, User$summariesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SummaryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    calendar_events<T extends User$calendar_eventsArgs<ExtArgs> = {}>(args?: Subset<T, User$calendar_eventsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    gmail_messages<T extends User$gmail_messagesArgs<ExtArgs> = {}>(args?: Subset<T, User$gmail_messagesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GmailMessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly supabaseId: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly display_name: FieldRef<"User", 'String'>
    readonly google_connected: FieldRef<"User", 'Boolean'>
    readonly google_access_token: FieldRef<"User", 'String'>
    readonly google_refresh_token: FieldRef<"User", 'String'>
    readonly created_at: FieldRef<"User", 'DateTime'>
    readonly updated_at: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.diary_entries
   */
  export type User$diary_entriesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    where?: DiaryEntryWhereInput
    orderBy?: DiaryEntryOrderByWithRelationInput | DiaryEntryOrderByWithRelationInput[]
    cursor?: DiaryEntryWhereUniqueInput
    take?: number
    skip?: number
    distinct?: DiaryEntryScalarFieldEnum | DiaryEntryScalarFieldEnum[]
  }

  /**
   * User.memory_chunks
   */
  export type User$memory_chunksArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
    where?: MemoryChunkWhereInput
    orderBy?: MemoryChunkOrderByWithRelationInput | MemoryChunkOrderByWithRelationInput[]
    cursor?: MemoryChunkWhereUniqueInput
    take?: number
    skip?: number
    distinct?: MemoryChunkScalarFieldEnum | MemoryChunkScalarFieldEnum[]
  }

  /**
   * User.summaries
   */
  export type User$summariesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Summary
     */
    select?: SummarySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Summary
     */
    omit?: SummaryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SummaryInclude<ExtArgs> | null
    where?: SummaryWhereInput
    orderBy?: SummaryOrderByWithRelationInput | SummaryOrderByWithRelationInput[]
    cursor?: SummaryWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SummaryScalarFieldEnum | SummaryScalarFieldEnum[]
  }

  /**
   * User.calendar_events
   */
  export type User$calendar_eventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    where?: CalendarEventWhereInput
    orderBy?: CalendarEventOrderByWithRelationInput | CalendarEventOrderByWithRelationInput[]
    cursor?: CalendarEventWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CalendarEventScalarFieldEnum | CalendarEventScalarFieldEnum[]
  }

  /**
   * User.gmail_messages
   */
  export type User$gmail_messagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GmailMessage
     */
    select?: GmailMessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GmailMessage
     */
    omit?: GmailMessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GmailMessageInclude<ExtArgs> | null
    where?: GmailMessageWhereInput
    orderBy?: GmailMessageOrderByWithRelationInput | GmailMessageOrderByWithRelationInput[]
    cursor?: GmailMessageWhereUniqueInput
    take?: number
    skip?: number
    distinct?: GmailMessageScalarFieldEnum | GmailMessageScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model DiaryEntry
   */

  export type AggregateDiaryEntry = {
    _count: DiaryEntryCountAggregateOutputType | null
    _min: DiaryEntryMinAggregateOutputType | null
    _max: DiaryEntryMaxAggregateOutputType | null
  }

  export type DiaryEntryMinAggregateOutputType = {
    id: string | null
    user_id: string | null
    entry_date: Date | null
    raw_text: string | null
    status: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type DiaryEntryMaxAggregateOutputType = {
    id: string | null
    user_id: string | null
    entry_date: Date | null
    raw_text: string | null
    status: string | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type DiaryEntryCountAggregateOutputType = {
    id: number
    user_id: number
    entry_date: number
    raw_text: number
    status: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type DiaryEntryMinAggregateInputType = {
    id?: true
    user_id?: true
    entry_date?: true
    raw_text?: true
    status?: true
    created_at?: true
    updated_at?: true
  }

  export type DiaryEntryMaxAggregateInputType = {
    id?: true
    user_id?: true
    entry_date?: true
    raw_text?: true
    status?: true
    created_at?: true
    updated_at?: true
  }

  export type DiaryEntryCountAggregateInputType = {
    id?: true
    user_id?: true
    entry_date?: true
    raw_text?: true
    status?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type DiaryEntryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DiaryEntry to aggregate.
     */
    where?: DiaryEntryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DiaryEntries to fetch.
     */
    orderBy?: DiaryEntryOrderByWithRelationInput | DiaryEntryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DiaryEntryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DiaryEntries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DiaryEntries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned DiaryEntries
    **/
    _count?: true | DiaryEntryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DiaryEntryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DiaryEntryMaxAggregateInputType
  }

  export type GetDiaryEntryAggregateType<T extends DiaryEntryAggregateArgs> = {
        [P in keyof T & keyof AggregateDiaryEntry]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDiaryEntry[P]>
      : GetScalarType<T[P], AggregateDiaryEntry[P]>
  }




  export type DiaryEntryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DiaryEntryWhereInput
    orderBy?: DiaryEntryOrderByWithAggregationInput | DiaryEntryOrderByWithAggregationInput[]
    by: DiaryEntryScalarFieldEnum[] | DiaryEntryScalarFieldEnum
    having?: DiaryEntryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DiaryEntryCountAggregateInputType | true
    _min?: DiaryEntryMinAggregateInputType
    _max?: DiaryEntryMaxAggregateInputType
  }

  export type DiaryEntryGroupByOutputType = {
    id: string
    user_id: string
    entry_date: Date
    raw_text: string
    status: string
    created_at: Date
    updated_at: Date
    _count: DiaryEntryCountAggregateOutputType | null
    _min: DiaryEntryMinAggregateOutputType | null
    _max: DiaryEntryMaxAggregateOutputType | null
  }

  type GetDiaryEntryGroupByPayload<T extends DiaryEntryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DiaryEntryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DiaryEntryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DiaryEntryGroupByOutputType[P]>
            : GetScalarType<T[P], DiaryEntryGroupByOutputType[P]>
        }
      >
    >


  export type DiaryEntrySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    entry_date?: boolean
    raw_text?: boolean
    status?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    attachments?: boolean | DiaryEntry$attachmentsArgs<ExtArgs>
    calendar_events?: boolean | DiaryEntry$calendar_eventsArgs<ExtArgs>
    _count?: boolean | DiaryEntryCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["diaryEntry"]>

  export type DiaryEntrySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    entry_date?: boolean
    raw_text?: boolean
    status?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["diaryEntry"]>

  export type DiaryEntrySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    user_id?: boolean
    entry_date?: boolean
    raw_text?: boolean
    status?: boolean
    created_at?: boolean
    updated_at?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["diaryEntry"]>

  export type DiaryEntrySelectScalar = {
    id?: boolean
    user_id?: boolean
    entry_date?: boolean
    raw_text?: boolean
    status?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type DiaryEntryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "user_id" | "entry_date" | "raw_text" | "status" | "created_at" | "updated_at", ExtArgs["result"]["diaryEntry"]>
  export type DiaryEntryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    attachments?: boolean | DiaryEntry$attachmentsArgs<ExtArgs>
    calendar_events?: boolean | DiaryEntry$calendar_eventsArgs<ExtArgs>
    _count?: boolean | DiaryEntryCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type DiaryEntryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type DiaryEntryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $DiaryEntryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "DiaryEntry"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      attachments: Prisma.$AttachmentPayload<ExtArgs>[]
      calendar_events: Prisma.$CalendarEventPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      user_id: string
      entry_date: Date
      raw_text: string
      status: string
      created_at: Date
      updated_at: Date
    }, ExtArgs["result"]["diaryEntry"]>
    composites: {}
  }

  type DiaryEntryGetPayload<S extends boolean | null | undefined | DiaryEntryDefaultArgs> = $Result.GetResult<Prisma.$DiaryEntryPayload, S>

  type DiaryEntryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<DiaryEntryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: DiaryEntryCountAggregateInputType | true
    }

  export interface DiaryEntryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['DiaryEntry'], meta: { name: 'DiaryEntry' } }
    /**
     * Find zero or one DiaryEntry that matches the filter.
     * @param {DiaryEntryFindUniqueArgs} args - Arguments to find a DiaryEntry
     * @example
     * // Get one DiaryEntry
     * const diaryEntry = await prisma.diaryEntry.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DiaryEntryFindUniqueArgs>(args: SelectSubset<T, DiaryEntryFindUniqueArgs<ExtArgs>>): Prisma__DiaryEntryClient<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one DiaryEntry that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {DiaryEntryFindUniqueOrThrowArgs} args - Arguments to find a DiaryEntry
     * @example
     * // Get one DiaryEntry
     * const diaryEntry = await prisma.diaryEntry.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DiaryEntryFindUniqueOrThrowArgs>(args: SelectSubset<T, DiaryEntryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DiaryEntryClient<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first DiaryEntry that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiaryEntryFindFirstArgs} args - Arguments to find a DiaryEntry
     * @example
     * // Get one DiaryEntry
     * const diaryEntry = await prisma.diaryEntry.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DiaryEntryFindFirstArgs>(args?: SelectSubset<T, DiaryEntryFindFirstArgs<ExtArgs>>): Prisma__DiaryEntryClient<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first DiaryEntry that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiaryEntryFindFirstOrThrowArgs} args - Arguments to find a DiaryEntry
     * @example
     * // Get one DiaryEntry
     * const diaryEntry = await prisma.diaryEntry.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DiaryEntryFindFirstOrThrowArgs>(args?: SelectSubset<T, DiaryEntryFindFirstOrThrowArgs<ExtArgs>>): Prisma__DiaryEntryClient<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more DiaryEntries that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiaryEntryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all DiaryEntries
     * const diaryEntries = await prisma.diaryEntry.findMany()
     * 
     * // Get first 10 DiaryEntries
     * const diaryEntries = await prisma.diaryEntry.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const diaryEntryWithIdOnly = await prisma.diaryEntry.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DiaryEntryFindManyArgs>(args?: SelectSubset<T, DiaryEntryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a DiaryEntry.
     * @param {DiaryEntryCreateArgs} args - Arguments to create a DiaryEntry.
     * @example
     * // Create one DiaryEntry
     * const DiaryEntry = await prisma.diaryEntry.create({
     *   data: {
     *     // ... data to create a DiaryEntry
     *   }
     * })
     * 
     */
    create<T extends DiaryEntryCreateArgs>(args: SelectSubset<T, DiaryEntryCreateArgs<ExtArgs>>): Prisma__DiaryEntryClient<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many DiaryEntries.
     * @param {DiaryEntryCreateManyArgs} args - Arguments to create many DiaryEntries.
     * @example
     * // Create many DiaryEntries
     * const diaryEntry = await prisma.diaryEntry.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DiaryEntryCreateManyArgs>(args?: SelectSubset<T, DiaryEntryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many DiaryEntries and returns the data saved in the database.
     * @param {DiaryEntryCreateManyAndReturnArgs} args - Arguments to create many DiaryEntries.
     * @example
     * // Create many DiaryEntries
     * const diaryEntry = await prisma.diaryEntry.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many DiaryEntries and only return the `id`
     * const diaryEntryWithIdOnly = await prisma.diaryEntry.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DiaryEntryCreateManyAndReturnArgs>(args?: SelectSubset<T, DiaryEntryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a DiaryEntry.
     * @param {DiaryEntryDeleteArgs} args - Arguments to delete one DiaryEntry.
     * @example
     * // Delete one DiaryEntry
     * const DiaryEntry = await prisma.diaryEntry.delete({
     *   where: {
     *     // ... filter to delete one DiaryEntry
     *   }
     * })
     * 
     */
    delete<T extends DiaryEntryDeleteArgs>(args: SelectSubset<T, DiaryEntryDeleteArgs<ExtArgs>>): Prisma__DiaryEntryClient<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one DiaryEntry.
     * @param {DiaryEntryUpdateArgs} args - Arguments to update one DiaryEntry.
     * @example
     * // Update one DiaryEntry
     * const diaryEntry = await prisma.diaryEntry.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DiaryEntryUpdateArgs>(args: SelectSubset<T, DiaryEntryUpdateArgs<ExtArgs>>): Prisma__DiaryEntryClient<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more DiaryEntries.
     * @param {DiaryEntryDeleteManyArgs} args - Arguments to filter DiaryEntries to delete.
     * @example
     * // Delete a few DiaryEntries
     * const { count } = await prisma.diaryEntry.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DiaryEntryDeleteManyArgs>(args?: SelectSubset<T, DiaryEntryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DiaryEntries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiaryEntryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many DiaryEntries
     * const diaryEntry = await prisma.diaryEntry.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DiaryEntryUpdateManyArgs>(args: SelectSubset<T, DiaryEntryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DiaryEntries and returns the data updated in the database.
     * @param {DiaryEntryUpdateManyAndReturnArgs} args - Arguments to update many DiaryEntries.
     * @example
     * // Update many DiaryEntries
     * const diaryEntry = await prisma.diaryEntry.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more DiaryEntries and only return the `id`
     * const diaryEntryWithIdOnly = await prisma.diaryEntry.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends DiaryEntryUpdateManyAndReturnArgs>(args: SelectSubset<T, DiaryEntryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one DiaryEntry.
     * @param {DiaryEntryUpsertArgs} args - Arguments to update or create a DiaryEntry.
     * @example
     * // Update or create a DiaryEntry
     * const diaryEntry = await prisma.diaryEntry.upsert({
     *   create: {
     *     // ... data to create a DiaryEntry
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the DiaryEntry we want to update
     *   }
     * })
     */
    upsert<T extends DiaryEntryUpsertArgs>(args: SelectSubset<T, DiaryEntryUpsertArgs<ExtArgs>>): Prisma__DiaryEntryClient<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of DiaryEntries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiaryEntryCountArgs} args - Arguments to filter DiaryEntries to count.
     * @example
     * // Count the number of DiaryEntries
     * const count = await prisma.diaryEntry.count({
     *   where: {
     *     // ... the filter for the DiaryEntries we want to count
     *   }
     * })
    **/
    count<T extends DiaryEntryCountArgs>(
      args?: Subset<T, DiaryEntryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DiaryEntryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a DiaryEntry.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiaryEntryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DiaryEntryAggregateArgs>(args: Subset<T, DiaryEntryAggregateArgs>): Prisma.PrismaPromise<GetDiaryEntryAggregateType<T>>

    /**
     * Group by DiaryEntry.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DiaryEntryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DiaryEntryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DiaryEntryGroupByArgs['orderBy'] }
        : { orderBy?: DiaryEntryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DiaryEntryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDiaryEntryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the DiaryEntry model
   */
  readonly fields: DiaryEntryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for DiaryEntry.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DiaryEntryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    attachments<T extends DiaryEntry$attachmentsArgs<ExtArgs> = {}>(args?: Subset<T, DiaryEntry$attachmentsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    calendar_events<T extends DiaryEntry$calendar_eventsArgs<ExtArgs> = {}>(args?: Subset<T, DiaryEntry$calendar_eventsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CalendarEventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the DiaryEntry model
   */
  interface DiaryEntryFieldRefs {
    readonly id: FieldRef<"DiaryEntry", 'String'>
    readonly user_id: FieldRef<"DiaryEntry", 'String'>
    readonly entry_date: FieldRef<"DiaryEntry", 'DateTime'>
    readonly raw_text: FieldRef<"DiaryEntry", 'String'>
    readonly status: FieldRef<"DiaryEntry", 'String'>
    readonly created_at: FieldRef<"DiaryEntry", 'DateTime'>
    readonly updated_at: FieldRef<"DiaryEntry", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * DiaryEntry findUnique
   */
  export type DiaryEntryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    /**
     * Filter, which DiaryEntry to fetch.
     */
    where: DiaryEntryWhereUniqueInput
  }

  /**
   * DiaryEntry findUniqueOrThrow
   */
  export type DiaryEntryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    /**
     * Filter, which DiaryEntry to fetch.
     */
    where: DiaryEntryWhereUniqueInput
  }

  /**
   * DiaryEntry findFirst
   */
  export type DiaryEntryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    /**
     * Filter, which DiaryEntry to fetch.
     */
    where?: DiaryEntryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DiaryEntries to fetch.
     */
    orderBy?: DiaryEntryOrderByWithRelationInput | DiaryEntryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DiaryEntries.
     */
    cursor?: DiaryEntryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DiaryEntries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DiaryEntries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DiaryEntries.
     */
    distinct?: DiaryEntryScalarFieldEnum | DiaryEntryScalarFieldEnum[]
  }

  /**
   * DiaryEntry findFirstOrThrow
   */
  export type DiaryEntryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    /**
     * Filter, which DiaryEntry to fetch.
     */
    where?: DiaryEntryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DiaryEntries to fetch.
     */
    orderBy?: DiaryEntryOrderByWithRelationInput | DiaryEntryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DiaryEntries.
     */
    cursor?: DiaryEntryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DiaryEntries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DiaryEntries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DiaryEntries.
     */
    distinct?: DiaryEntryScalarFieldEnum | DiaryEntryScalarFieldEnum[]
  }

  /**
   * DiaryEntry findMany
   */
  export type DiaryEntryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    /**
     * Filter, which DiaryEntries to fetch.
     */
    where?: DiaryEntryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DiaryEntries to fetch.
     */
    orderBy?: DiaryEntryOrderByWithRelationInput | DiaryEntryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing DiaryEntries.
     */
    cursor?: DiaryEntryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DiaryEntries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DiaryEntries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DiaryEntries.
     */
    distinct?: DiaryEntryScalarFieldEnum | DiaryEntryScalarFieldEnum[]
  }

  /**
   * DiaryEntry create
   */
  export type DiaryEntryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    /**
     * The data needed to create a DiaryEntry.
     */
    data: XOR<DiaryEntryCreateInput, DiaryEntryUncheckedCreateInput>
  }

  /**
   * DiaryEntry createMany
   */
  export type DiaryEntryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many DiaryEntries.
     */
    data: DiaryEntryCreateManyInput | DiaryEntryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * DiaryEntry createManyAndReturn
   */
  export type DiaryEntryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * The data used to create many DiaryEntries.
     */
    data: DiaryEntryCreateManyInput | DiaryEntryCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * DiaryEntry update
   */
  export type DiaryEntryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    /**
     * The data needed to update a DiaryEntry.
     */
    data: XOR<DiaryEntryUpdateInput, DiaryEntryUncheckedUpdateInput>
    /**
     * Choose, which DiaryEntry to update.
     */
    where: DiaryEntryWhereUniqueInput
  }

  /**
   * DiaryEntry updateMany
   */
  export type DiaryEntryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update DiaryEntries.
     */
    data: XOR<DiaryEntryUpdateManyMutationInput, DiaryEntryUncheckedUpdateManyInput>
    /**
     * Filter which DiaryEntries to update
     */
    where?: DiaryEntryWhereInput
    /**
     * Limit how many DiaryEntries to update.
     */
    limit?: number
  }

  /**
   * DiaryEntry updateManyAndReturn
   */
  export type DiaryEntryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * The data used to update DiaryEntries.
     */
    data: XOR<DiaryEntryUpdateManyMutationInput, DiaryEntryUncheckedUpdateManyInput>
    /**
     * Filter which DiaryEntries to update
     */
    where?: DiaryEntryWhereInput
    /**
     * Limit how many DiaryEntries to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * DiaryEntry upsert
   */
  export type DiaryEntryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    /**
     * The filter to search for the DiaryEntry to update in case it exists.
     */
    where: DiaryEntryWhereUniqueInput
    /**
     * In case the DiaryEntry found by the `where` argument doesn't exist, create a new DiaryEntry with this data.
     */
    create: XOR<DiaryEntryCreateInput, DiaryEntryUncheckedCreateInput>
    /**
     * In case the DiaryEntry was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DiaryEntryUpdateInput, DiaryEntryUncheckedUpdateInput>
  }

  /**
   * DiaryEntry delete
   */
  export type DiaryEntryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
    /**
     * Filter which DiaryEntry to delete.
     */
    where: DiaryEntryWhereUniqueInput
  }

  /**
   * DiaryEntry deleteMany
   */
  export type DiaryEntryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DiaryEntries to delete
     */
    where?: DiaryEntryWhereInput
    /**
     * Limit how many DiaryEntries to delete.
     */
    limit?: number
  }

  /**
   * DiaryEntry.attachments
   */
  export type DiaryEntry$attachmentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
    where?: AttachmentWhereInput
    orderBy?: AttachmentOrderByWithRelationInput | AttachmentOrderByWithRelationInput[]
    cursor?: AttachmentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AttachmentScalarFieldEnum | AttachmentScalarFieldEnum[]
  }

  /**
   * DiaryEntry.calendar_events
   */
  export type DiaryEntry$calendar_eventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CalendarEvent
     */
    select?: CalendarEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CalendarEvent
     */
    omit?: CalendarEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CalendarEventInclude<ExtArgs> | null
    where?: CalendarEventWhereInput
    orderBy?: CalendarEventOrderByWithRelationInput | CalendarEventOrderByWithRelationInput[]
    cursor?: CalendarEventWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CalendarEventScalarFieldEnum | CalendarEventScalarFieldEnum[]
  }

  /**
   * DiaryEntry without action
   */
  export type DiaryEntryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DiaryEntry
     */
    select?: DiaryEntrySelect<ExtArgs> | null
    /**
     * Omit specific fields from the DiaryEntry
     */
    omit?: DiaryEntryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DiaryEntryInclude<ExtArgs> | null
  }


  /**
   * Model Attachment
   */

  export type AggregateAttachment = {
    _count: AttachmentCountAggregateOutputType | null
    _min: AttachmentMinAggregateOutputType | null
    _max: AttachmentMaxAggregateOutputType | null
  }

  export type AttachmentMinAggregateOutputType = {
    id: string | null
    diary_entry_id: string | null
    storage_path: string | null
    file_type: string | null
    extracted_text: string | null
    created_at: Date | null
  }

  export type AttachmentMaxAggregateOutputType = {
    id: string | null
    diary_entry_id: string | null
    storage_path: string | null
    file_type: string | null
    extracted_text: string | null
    created_at: Date | null
  }

  export type AttachmentCountAggregateOutputType = {
    id: number
    diary_entry_id: number
    storage_path: number
    file_type: number
    extracted_text: number
    created_at: number
    _all: number
  }


  export type AttachmentMinAggregateInputType = {
    id?: true
    diary_entry_id?: true
    storage_path?: true
    file_type?: true
    extracted_text?: true
    created_at?: true
  }

  export type AttachmentMaxAggregateInputType = {
    id?: true
    diary_entry_id?: true
    storage_path?: true
    file_type?: true
    extracted_text?: true
    created_at?: true
  }

  export type AttachmentCountAggregateInputType = {
    id?: true
    diary_entry_id?: true
    storage_path?: true
    file_type?: true
    extracted_text?: true
    created_at?: true
    _all?: true
  }

  export type AttachmentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Attachment to aggregate.
     */
    where?: AttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Attachments to fetch.
     */
    orderBy?: AttachmentOrderByWithRelationInput | AttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Attachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Attachments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Attachments
    **/
    _count?: true | AttachmentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AttachmentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AttachmentMaxAggregateInputType
  }

  export type GetAttachmentAggregateType<T extends AttachmentAggregateArgs> = {
        [P in keyof T & keyof AggregateAttachment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAttachment[P]>
      : GetScalarType<T[P], AggregateAttachment[P]>
  }




  export type AttachmentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AttachmentWhereInput
    orderBy?: AttachmentOrderByWithAggregationInput | AttachmentOrderByWithAggregationInput[]
    by: AttachmentScalarFieldEnum[] | AttachmentScalarFieldEnum
    having?: AttachmentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AttachmentCountAggregateInputType | true
    _min?: AttachmentMinAggregateInputType
    _max?: AttachmentMaxAggregateInputType
  }

  export type AttachmentGroupByOutputType = {
    id: string
    diary_entry_id: string
    storage_path: string
    file_type: string
    extracted_text: string | null
    created_at: Date
    _count: AttachmentCountAggregateOutputType | null
    _min: AttachmentMinAggregateOutputType | null
    _max: AttachmentMaxAggregateOutputType | null
  }

  type GetAttachmentGroupByPayload<T extends AttachmentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AttachmentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AttachmentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AttachmentGroupByOutputType[P]>
            : GetScalarType<T[P], AttachmentGroupByOutputType[P]>
        }
      >
    >


  export type AttachmentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    diary_entry_id?: boolean
    storage_path?: boolean
    file_type?: boolean
    extracted_text?: boolean
    created_at?: boolean
    diary_entry?: boolean | DiaryEntryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["attachment"]>

  export type AttachmentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    diary_entry_id?: boolean
    storage_path?: boolean
    file_type?: boolean
    extracted_text?: boolean
    created_at?: boolean
    diary_entry?: boolean | DiaryEntryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["attachment"]>

  export type AttachmentSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    diary_entry_id?: boolean
    storage_path?: boolean
    file_type?: boolean
    extracted_text?: boolean
    created_at?: boolean
    diary_entry?: boolean | DiaryEntryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["attachment"]>

  export type AttachmentSelectScalar = {
    id?: boolean
    diary_entry_id?: boolean
    storage_path?: boolean
    file_type?: boolean
    extracted_text?: boolean
    created_at?: boolean
  }

  export type AttachmentOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "diary_entry_id" | "storage_path" | "file_type" | "extracted_text" | "created_at", ExtArgs["result"]["attachment"]>
  export type AttachmentInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    diary_entry?: boolean | DiaryEntryDefaultArgs<ExtArgs>
  }
  export type AttachmentIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    diary_entry?: boolean | DiaryEntryDefaultArgs<ExtArgs>
  }
  export type AttachmentIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    diary_entry?: boolean | DiaryEntryDefaultArgs<ExtArgs>
  }

  export type $AttachmentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Attachment"
    objects: {
      diary_entry: Prisma.$DiaryEntryPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      diary_entry_id: string
      storage_path: string
      file_type: string
      extracted_text: string | null
      created_at: Date
    }, ExtArgs["result"]["attachment"]>
    composites: {}
  }

  type AttachmentGetPayload<S extends boolean | null | undefined | AttachmentDefaultArgs> = $Result.GetResult<Prisma.$AttachmentPayload, S>

  type AttachmentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AttachmentFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AttachmentCountAggregateInputType | true
    }

  export interface AttachmentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Attachment'], meta: { name: 'Attachment' } }
    /**
     * Find zero or one Attachment that matches the filter.
     * @param {AttachmentFindUniqueArgs} args - Arguments to find a Attachment
     * @example
     * // Get one Attachment
     * const attachment = await prisma.attachment.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AttachmentFindUniqueArgs>(args: SelectSubset<T, AttachmentFindUniqueArgs<ExtArgs>>): Prisma__AttachmentClient<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Attachment that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AttachmentFindUniqueOrThrowArgs} args - Arguments to find a Attachment
     * @example
     * // Get one Attachment
     * const attachment = await prisma.attachment.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AttachmentFindUniqueOrThrowArgs>(args: SelectSubset<T, AttachmentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AttachmentClient<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Attachment that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentFindFirstArgs} args - Arguments to find a Attachment
     * @example
     * // Get one Attachment
     * const attachment = await prisma.attachment.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AttachmentFindFirstArgs>(args?: SelectSubset<T, AttachmentFindFirstArgs<ExtArgs>>): Prisma__AttachmentClient<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Attachment that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentFindFirstOrThrowArgs} args - Arguments to find a Attachment
     * @example
     * // Get one Attachment
     * const attachment = await prisma.attachment.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AttachmentFindFirstOrThrowArgs>(args?: SelectSubset<T, AttachmentFindFirstOrThrowArgs<ExtArgs>>): Prisma__AttachmentClient<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Attachments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Attachments
     * const attachments = await prisma.attachment.findMany()
     * 
     * // Get first 10 Attachments
     * const attachments = await prisma.attachment.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const attachmentWithIdOnly = await prisma.attachment.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AttachmentFindManyArgs>(args?: SelectSubset<T, AttachmentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Attachment.
     * @param {AttachmentCreateArgs} args - Arguments to create a Attachment.
     * @example
     * // Create one Attachment
     * const Attachment = await prisma.attachment.create({
     *   data: {
     *     // ... data to create a Attachment
     *   }
     * })
     * 
     */
    create<T extends AttachmentCreateArgs>(args: SelectSubset<T, AttachmentCreateArgs<ExtArgs>>): Prisma__AttachmentClient<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Attachments.
     * @param {AttachmentCreateManyArgs} args - Arguments to create many Attachments.
     * @example
     * // Create many Attachments
     * const attachment = await prisma.attachment.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AttachmentCreateManyArgs>(args?: SelectSubset<T, AttachmentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Attachments and returns the data saved in the database.
     * @param {AttachmentCreateManyAndReturnArgs} args - Arguments to create many Attachments.
     * @example
     * // Create many Attachments
     * const attachment = await prisma.attachment.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Attachments and only return the `id`
     * const attachmentWithIdOnly = await prisma.attachment.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AttachmentCreateManyAndReturnArgs>(args?: SelectSubset<T, AttachmentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Attachment.
     * @param {AttachmentDeleteArgs} args - Arguments to delete one Attachment.
     * @example
     * // Delete one Attachment
     * const Attachment = await prisma.attachment.delete({
     *   where: {
     *     // ... filter to delete one Attachment
     *   }
     * })
     * 
     */
    delete<T extends AttachmentDeleteArgs>(args: SelectSubset<T, AttachmentDeleteArgs<ExtArgs>>): Prisma__AttachmentClient<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Attachment.
     * @param {AttachmentUpdateArgs} args - Arguments to update one Attachment.
     * @example
     * // Update one Attachment
     * const attachment = await prisma.attachment.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AttachmentUpdateArgs>(args: SelectSubset<T, AttachmentUpdateArgs<ExtArgs>>): Prisma__AttachmentClient<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Attachments.
     * @param {AttachmentDeleteManyArgs} args - Arguments to filter Attachments to delete.
     * @example
     * // Delete a few Attachments
     * const { count } = await prisma.attachment.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AttachmentDeleteManyArgs>(args?: SelectSubset<T, AttachmentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Attachments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Attachments
     * const attachment = await prisma.attachment.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AttachmentUpdateManyArgs>(args: SelectSubset<T, AttachmentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Attachments and returns the data updated in the database.
     * @param {AttachmentUpdateManyAndReturnArgs} args - Arguments to update many Attachments.
     * @example
     * // Update many Attachments
     * const attachment = await prisma.attachment.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Attachments and only return the `id`
     * const attachmentWithIdOnly = await prisma.attachment.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AttachmentUpdateManyAndReturnArgs>(args: SelectSubset<T, AttachmentUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Attachment.
     * @param {AttachmentUpsertArgs} args - Arguments to update or create a Attachment.
     * @example
     * // Update or create a Attachment
     * const attachment = await prisma.attachment.upsert({
     *   create: {
     *     // ... data to create a Attachment
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Attachment we want to update
     *   }
     * })
     */
    upsert<T extends AttachmentUpsertArgs>(args: SelectSubset<T, AttachmentUpsertArgs<ExtArgs>>): Prisma__AttachmentClient<$Result.GetResult<Prisma.$AttachmentPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Attachments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentCountArgs} args - Arguments to filter Attachments to count.
     * @example
     * // Count the number of Attachments
     * const count = await prisma.attachment.count({
     *   where: {
     *     // ... the filter for the Attachments we want to count
     *   }
     * })
    **/
    count<T extends AttachmentCountArgs>(
      args?: Subset<T, AttachmentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AttachmentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Attachment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AttachmentAggregateArgs>(args: Subset<T, AttachmentAggregateArgs>): Prisma.PrismaPromise<GetAttachmentAggregateType<T>>

    /**
     * Group by Attachment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AttachmentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AttachmentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AttachmentGroupByArgs['orderBy'] }
        : { orderBy?: AttachmentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AttachmentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAttachmentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Attachment model
   */
  readonly fields: AttachmentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Attachment.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AttachmentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    diary_entry<T extends DiaryEntryDefaultArgs<ExtArgs> = {}>(args?: Subset<T, DiaryEntryDefaultArgs<ExtArgs>>): Prisma__DiaryEntryClient<$Result.GetResult<Prisma.$DiaryEntryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Attachment model
   */
  interface AttachmentFieldRefs {
    readonly id: FieldRef<"Attachment", 'String'>
    readonly diary_entry_id: FieldRef<"Attachment", 'String'>
    readonly storage_path: FieldRef<"Attachment", 'String'>
    readonly file_type: FieldRef<"Attachment", 'String'>
    readonly extracted_text: FieldRef<"Attachment", 'String'>
    readonly created_at: FieldRef<"Attachment", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Attachment findUnique
   */
  export type AttachmentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
    /**
     * Filter, which Attachment to fetch.
     */
    where: AttachmentWhereUniqueInput
  }

  /**
   * Attachment findUniqueOrThrow
   */
  export type AttachmentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
    /**
     * Filter, which Attachment to fetch.
     */
    where: AttachmentWhereUniqueInput
  }

  /**
   * Attachment findFirst
   */
  export type AttachmentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
    /**
     * Filter, which Attachment to fetch.
     */
    where?: AttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Attachments to fetch.
     */
    orderBy?: AttachmentOrderByWithRelationInput | AttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Attachments.
     */
    cursor?: AttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Attachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Attachments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Attachments.
     */
    distinct?: AttachmentScalarFieldEnum | AttachmentScalarFieldEnum[]
  }

  /**
   * Attachment findFirstOrThrow
   */
  export type AttachmentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
    /**
     * Filter, which Attachment to fetch.
     */
    where?: AttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Attachments to fetch.
     */
    orderBy?: AttachmentOrderByWithRelationInput | AttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Attachments.
     */
    cursor?: AttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Attachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Attachments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Attachments.
     */
    distinct?: AttachmentScalarFieldEnum | AttachmentScalarFieldEnum[]
  }

  /**
   * Attachment findMany
   */
  export type AttachmentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
    /**
     * Filter, which Attachments to fetch.
     */
    where?: AttachmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Attachments to fetch.
     */
    orderBy?: AttachmentOrderByWithRelationInput | AttachmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Attachments.
     */
    cursor?: AttachmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Attachments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Attachments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Attachments.
     */
    distinct?: AttachmentScalarFieldEnum | AttachmentScalarFieldEnum[]
  }

  /**
   * Attachment create
   */
  export type AttachmentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
    /**
     * The data needed to create a Attachment.
     */
    data: XOR<AttachmentCreateInput, AttachmentUncheckedCreateInput>
  }

  /**
   * Attachment createMany
   */
  export type AttachmentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Attachments.
     */
    data: AttachmentCreateManyInput | AttachmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Attachment createManyAndReturn
   */
  export type AttachmentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * The data used to create many Attachments.
     */
    data: AttachmentCreateManyInput | AttachmentCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Attachment update
   */
  export type AttachmentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
    /**
     * The data needed to update a Attachment.
     */
    data: XOR<AttachmentUpdateInput, AttachmentUncheckedUpdateInput>
    /**
     * Choose, which Attachment to update.
     */
    where: AttachmentWhereUniqueInput
  }

  /**
   * Attachment updateMany
   */
  export type AttachmentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Attachments.
     */
    data: XOR<AttachmentUpdateManyMutationInput, AttachmentUncheckedUpdateManyInput>
    /**
     * Filter which Attachments to update
     */
    where?: AttachmentWhereInput
    /**
     * Limit how many Attachments to update.
     */
    limit?: number
  }

  /**
   * Attachment updateManyAndReturn
   */
  export type AttachmentUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * The data used to update Attachments.
     */
    data: XOR<AttachmentUpdateManyMutationInput, AttachmentUncheckedUpdateManyInput>
    /**
     * Filter which Attachments to update
     */
    where?: AttachmentWhereInput
    /**
     * Limit how many Attachments to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Attachment upsert
   */
  export type AttachmentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
    /**
     * The filter to search for the Attachment to update in case it exists.
     */
    where: AttachmentWhereUniqueInput
    /**
     * In case the Attachment found by the `where` argument doesn't exist, create a new Attachment with this data.
     */
    create: XOR<AttachmentCreateInput, AttachmentUncheckedCreateInput>
    /**
     * In case the Attachment was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AttachmentUpdateInput, AttachmentUncheckedUpdateInput>
  }

  /**
   * Attachment delete
   */
  export type AttachmentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
    /**
     * Filter which Attachment to delete.
     */
    where: AttachmentWhereUniqueInput
  }

  /**
   * Attachment deleteMany
   */
  export type AttachmentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Attachments to delete
     */
    where?: AttachmentWhereInput
    /**
     * Limit how many Attachments to delete.
     */
    limit?: number
  }

  /**
   * Attachment without action
   */
  export type AttachmentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Attachment
     */
    select?: AttachmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Attachment
     */
    omit?: AttachmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AttachmentInclude<ExtArgs> | null
  }


  /**
   * Model MemoryChunk
   */

  export type AggregateMemoryChunk = {
    _count: MemoryChunkCountAggregateOutputType | null
    _min: MemoryChunkMinAggregateOutputType | null
    _max: MemoryChunkMaxAggregateOutputType | null
  }

  export type MemoryChunkMinAggregateOutputType = {
    id: string | null
    userId: string | null
    sourceType: string | null
    sourceId: string | null
    chunkType: string | null
    text: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MemoryChunkMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    sourceType: string | null
    sourceId: string | null
    chunkType: string | null
    text: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MemoryChunkCountAggregateOutputType = {
    id: number
    userId: number
    sourceType: number
    sourceId: number
    chunkType: number
    text: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type MemoryChunkMinAggregateInputType = {
    id?: true
    userId?: true
    sourceType?: true
    sourceId?: true
    chunkType?: true
    text?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MemoryChunkMaxAggregateInputType = {
    id?: true
    userId?: true
    sourceType?: true
    sourceId?: true
    chunkType?: true
    text?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MemoryChunkCountAggregateInputType = {
    id?: true
    userId?: true
    sourceType?: true
    sourceId?: true
    chunkType?: true
    text?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type MemoryChunkAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MemoryChunk to aggregate.
     */
    where?: MemoryChunkWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MemoryChunks to fetch.
     */
    orderBy?: MemoryChunkOrderByWithRelationInput | MemoryChunkOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MemoryChunkWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MemoryChunks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MemoryChunks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MemoryChunks
    **/
    _count?: true | MemoryChunkCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MemoryChunkMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MemoryChunkMaxAggregateInputType
  }

  export type GetMemoryChunkAggregateType<T extends MemoryChunkAggregateArgs> = {
        [P in keyof T & keyof AggregateMemoryChunk]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMemoryChunk[P]>
      : GetScalarType<T[P], AggregateMemoryChunk[P]>
  }




  export type MemoryChunkGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MemoryChunkWhereInput
    orderBy?: MemoryChunkOrderByWithAggregationInput | MemoryChunkOrderByWithAggregationInput[]
    by: MemoryChunkScalarFieldEnum[] | MemoryChunkScalarFieldEnum
    having?: MemoryChunkScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MemoryChunkCountAggregateInputType | true
    _min?: MemoryChunkMinAggregateInputType
    _max?: MemoryChunkMaxAggregateInputType
  }

  export type MemoryChunkGroupByOutputType = {
    id: string
    userId: string
    sourceType: string
    sourceId: string
    chunkType: string
    text: string
    metadata: JsonValue | null
    createdAt: Date
    updatedAt: Date
    _count: MemoryChunkCountAggregateOutputType | null
    _min: MemoryChunkMinAggregateOutputType | null
    _max: MemoryChunkMaxAggregateOutputType | null
  }

  type GetMemoryChunkGroupByPayload<T extends MemoryChunkGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MemoryChunkGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MemoryChunkGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MemoryChunkGroupByOutputType[P]>
            : GetScalarType<T[P], MemoryChunkGroupByOutputType[P]>
        }
      >
    >


  export type MemoryChunkSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    sourceType?: boolean
    sourceId?: boolean
    chunkType?: boolean
    text?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    entity_mentions?: boolean | MemoryChunk$entity_mentionsArgs<ExtArgs>
    _count?: boolean | MemoryChunkCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["memoryChunk"]>

  export type MemoryChunkSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    sourceType?: boolean
    sourceId?: boolean
    chunkType?: boolean
    text?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["memoryChunk"]>

  export type MemoryChunkSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    sourceType?: boolean
    sourceId?: boolean
    chunkType?: boolean
    text?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["memoryChunk"]>

  export type MemoryChunkSelectScalar = {
    id?: boolean
    userId?: boolean
    sourceType?: boolean
    sourceId?: boolean
    chunkType?: boolean
    text?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type MemoryChunkOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "sourceType" | "sourceId" | "chunkType" | "text" | "metadata" | "createdAt" | "updatedAt", ExtArgs["result"]["memoryChunk"]>
  export type MemoryChunkInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    entity_mentions?: boolean | MemoryChunk$entity_mentionsArgs<ExtArgs>
    _count?: boolean | MemoryChunkCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type MemoryChunkIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type MemoryChunkIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $MemoryChunkPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MemoryChunk"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      entity_mentions: Prisma.$EntityMentionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      sourceType: string
      sourceId: string
      chunkType: string
      text: string
      metadata: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["memoryChunk"]>
    composites: {}
  }

  type MemoryChunkGetPayload<S extends boolean | null | undefined | MemoryChunkDefaultArgs> = $Result.GetResult<Prisma.$MemoryChunkPayload, S>

  type MemoryChunkCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MemoryChunkFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MemoryChunkCountAggregateInputType | true
    }

  export interface MemoryChunkDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MemoryChunk'], meta: { name: 'MemoryChunk' } }
    /**
     * Find zero or one MemoryChunk that matches the filter.
     * @param {MemoryChunkFindUniqueArgs} args - Arguments to find a MemoryChunk
     * @example
     * // Get one MemoryChunk
     * const memoryChunk = await prisma.memoryChunk.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MemoryChunkFindUniqueArgs>(args: SelectSubset<T, MemoryChunkFindUniqueArgs<ExtArgs>>): Prisma__MemoryChunkClient<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one MemoryChunk that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MemoryChunkFindUniqueOrThrowArgs} args - Arguments to find a MemoryChunk
     * @example
     * // Get one MemoryChunk
     * const memoryChunk = await prisma.memoryChunk.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MemoryChunkFindUniqueOrThrowArgs>(args: SelectSubset<T, MemoryChunkFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MemoryChunkClient<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MemoryChunk that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MemoryChunkFindFirstArgs} args - Arguments to find a MemoryChunk
     * @example
     * // Get one MemoryChunk
     * const memoryChunk = await prisma.memoryChunk.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MemoryChunkFindFirstArgs>(args?: SelectSubset<T, MemoryChunkFindFirstArgs<ExtArgs>>): Prisma__MemoryChunkClient<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MemoryChunk that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MemoryChunkFindFirstOrThrowArgs} args - Arguments to find a MemoryChunk
     * @example
     * // Get one MemoryChunk
     * const memoryChunk = await prisma.memoryChunk.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MemoryChunkFindFirstOrThrowArgs>(args?: SelectSubset<T, MemoryChunkFindFirstOrThrowArgs<ExtArgs>>): Prisma__MemoryChunkClient<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more MemoryChunks that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MemoryChunkFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MemoryChunks
     * const memoryChunks = await prisma.memoryChunk.findMany()
     * 
     * // Get first 10 MemoryChunks
     * const memoryChunks = await prisma.memoryChunk.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const memoryChunkWithIdOnly = await prisma.memoryChunk.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MemoryChunkFindManyArgs>(args?: SelectSubset<T, MemoryChunkFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a MemoryChunk.
     * @param {MemoryChunkCreateArgs} args - Arguments to create a MemoryChunk.
     * @example
     * // Create one MemoryChunk
     * const MemoryChunk = await prisma.memoryChunk.create({
     *   data: {
     *     // ... data to create a MemoryChunk
     *   }
     * })
     * 
     */
    create<T extends MemoryChunkCreateArgs>(args: SelectSubset<T, MemoryChunkCreateArgs<ExtArgs>>): Prisma__MemoryChunkClient<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many MemoryChunks.
     * @param {MemoryChunkCreateManyArgs} args - Arguments to create many MemoryChunks.
     * @example
     * // Create many MemoryChunks
     * const memoryChunk = await prisma.memoryChunk.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MemoryChunkCreateManyArgs>(args?: SelectSubset<T, MemoryChunkCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MemoryChunks and returns the data saved in the database.
     * @param {MemoryChunkCreateManyAndReturnArgs} args - Arguments to create many MemoryChunks.
     * @example
     * // Create many MemoryChunks
     * const memoryChunk = await prisma.memoryChunk.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MemoryChunks and only return the `id`
     * const memoryChunkWithIdOnly = await prisma.memoryChunk.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MemoryChunkCreateManyAndReturnArgs>(args?: SelectSubset<T, MemoryChunkCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a MemoryChunk.
     * @param {MemoryChunkDeleteArgs} args - Arguments to delete one MemoryChunk.
     * @example
     * // Delete one MemoryChunk
     * const MemoryChunk = await prisma.memoryChunk.delete({
     *   where: {
     *     // ... filter to delete one MemoryChunk
     *   }
     * })
     * 
     */
    delete<T extends MemoryChunkDeleteArgs>(args: SelectSubset<T, MemoryChunkDeleteArgs<ExtArgs>>): Prisma__MemoryChunkClient<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one MemoryChunk.
     * @param {MemoryChunkUpdateArgs} args - Arguments to update one MemoryChunk.
     * @example
     * // Update one MemoryChunk
     * const memoryChunk = await prisma.memoryChunk.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MemoryChunkUpdateArgs>(args: SelectSubset<T, MemoryChunkUpdateArgs<ExtArgs>>): Prisma__MemoryChunkClient<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more MemoryChunks.
     * @param {MemoryChunkDeleteManyArgs} args - Arguments to filter MemoryChunks to delete.
     * @example
     * // Delete a few MemoryChunks
     * const { count } = await prisma.memoryChunk.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MemoryChunkDeleteManyArgs>(args?: SelectSubset<T, MemoryChunkDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MemoryChunks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MemoryChunkUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MemoryChunks
     * const memoryChunk = await prisma.memoryChunk.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MemoryChunkUpdateManyArgs>(args: SelectSubset<T, MemoryChunkUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MemoryChunks and returns the data updated in the database.
     * @param {MemoryChunkUpdateManyAndReturnArgs} args - Arguments to update many MemoryChunks.
     * @example
     * // Update many MemoryChunks
     * const memoryChunk = await prisma.memoryChunk.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more MemoryChunks and only return the `id`
     * const memoryChunkWithIdOnly = await prisma.memoryChunk.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends MemoryChunkUpdateManyAndReturnArgs>(args: SelectSubset<T, MemoryChunkUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one MemoryChunk.
     * @param {MemoryChunkUpsertArgs} args - Arguments to update or create a MemoryChunk.
     * @example
     * // Update or create a MemoryChunk
     * const memoryChunk = await prisma.memoryChunk.upsert({
     *   create: {
     *     // ... data to create a MemoryChunk
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MemoryChunk we want to update
     *   }
     * })
     */
    upsert<T extends MemoryChunkUpsertArgs>(args: SelectSubset<T, MemoryChunkUpsertArgs<ExtArgs>>): Prisma__MemoryChunkClient<$Result.GetResult<Prisma.$MemoryChunkPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of MemoryChunks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MemoryChunkCountArgs} args - Arguments to filter MemoryChunks to count.
     * @example
     * // Count the number of MemoryChunks
     * const count = await prisma.memoryChunk.count({
     *   where: {
     *     // ... the filter for the MemoryChunks we want to count
     *   }
     * })
    **/
    count<T extends MemoryChunkCountArgs>(
      args?: Subset<T, MemoryChunkCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MemoryChunkCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MemoryChunk.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MemoryChunkAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MemoryChunkAggregateArgs>(args: Subset<T, MemoryChunkAggregateArgs>): Prisma.PrismaPromise<GetMemoryChunkAggregateType<T>>

    /**
     * Group by MemoryChunk.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MemoryChunkGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MemoryChunkGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MemoryChunkGroupByArgs['orderBy'] }
        : { orderBy?: MemoryChunkGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MemoryChunkGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMemoryChunkGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MemoryChunk model
   */
  readonly fields: MemoryChunkFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MemoryChunk.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MemoryChunkClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    entity_mentions<T extends MemoryChunk$entity_mentionsArgs<ExtArgs> = {}>(args?: Subset<T, MemoryChunk$entity_mentionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EntityMentionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MemoryChunk model
   */
  interface MemoryChunkFieldRefs {
    readonly id: FieldRef<"MemoryChunk", 'String'>
    readonly userId: FieldRef<"MemoryChunk", 'String'>
    readonly sourceType: FieldRef<"MemoryChunk", 'String'>
    readonly sourceId: FieldRef<"MemoryChunk", 'String'>
    readonly chunkType: FieldRef<"MemoryChunk", 'String'>
    readonly text: FieldRef<"MemoryChunk", 'String'>
    readonly metadata: FieldRef<"MemoryChunk", 'Json'>
    readonly createdAt: FieldRef<"MemoryChunk", 'DateTime'>
    readonly updatedAt: FieldRef<"MemoryChunk", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * MemoryChunk findUnique
   */
  export type MemoryChunkFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
    /**
     * Filter, which MemoryChunk to fetch.
     */
    where: MemoryChunkWhereUniqueInput
  }

  /**
   * MemoryChunk findUniqueOrThrow
   */
  export type MemoryChunkFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
    /**
     * Filter, which MemoryChunk to fetch.
     */
    where: MemoryChunkWhereUniqueInput
  }

  /**
   * MemoryChunk findFirst
   */
  export type MemoryChunkFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
    /**
     * Filter, which MemoryChunk to fetch.
     */
    where?: MemoryChunkWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MemoryChunks to fetch.
     */
    orderBy?: MemoryChunkOrderByWithRelationInput | MemoryChunkOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MemoryChunks.
     */
    cursor?: MemoryChunkWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MemoryChunks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MemoryChunks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MemoryChunks.
     */
    distinct?: MemoryChunkScalarFieldEnum | MemoryChunkScalarFieldEnum[]
  }

  /**
   * MemoryChunk findFirstOrThrow
   */
  export type MemoryChunkFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
    /**
     * Filter, which MemoryChunk to fetch.
     */
    where?: MemoryChunkWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MemoryChunks to fetch.
     */
    orderBy?: MemoryChunkOrderByWithRelationInput | MemoryChunkOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MemoryChunks.
     */
    cursor?: MemoryChunkWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MemoryChunks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MemoryChunks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MemoryChunks.
     */
    distinct?: MemoryChunkScalarFieldEnum | MemoryChunkScalarFieldEnum[]
  }

  /**
   * MemoryChunk findMany
   */
  export type MemoryChunkFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
    /**
     * Filter, which MemoryChunks to fetch.
     */
    where?: MemoryChunkWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MemoryChunks to fetch.
     */
    orderBy?: MemoryChunkOrderByWithRelationInput | MemoryChunkOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MemoryChunks.
     */
    cursor?: MemoryChunkWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MemoryChunks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MemoryChunks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MemoryChunks.
     */
    distinct?: MemoryChunkScalarFieldEnum | MemoryChunkScalarFieldEnum[]
  }

  /**
   * MemoryChunk create
   */
  export type MemoryChunkCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
    /**
     * The data needed to create a MemoryChunk.
     */
    data: XOR<MemoryChunkCreateInput, MemoryChunkUncheckedCreateInput>
  }

  /**
   * MemoryChunk createMany
   */
  export type MemoryChunkCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MemoryChunks.
     */
    data: MemoryChunkCreateManyInput | MemoryChunkCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MemoryChunk createManyAndReturn
   */
  export type MemoryChunkCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * The data used to create many MemoryChunks.
     */
    data: MemoryChunkCreateManyInput | MemoryChunkCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * MemoryChunk update
   */
  export type MemoryChunkUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
    /**
     * The data needed to update a MemoryChunk.
     */
    data: XOR<MemoryChunkUpdateInput, MemoryChunkUncheckedUpdateInput>
    /**
     * Choose, which MemoryChunk to update.
     */
    where: MemoryChunkWhereUniqueInput
  }

  /**
   * MemoryChunk updateMany
   */
  export type MemoryChunkUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MemoryChunks.
     */
    data: XOR<MemoryChunkUpdateManyMutationInput, MemoryChunkUncheckedUpdateManyInput>
    /**
     * Filter which MemoryChunks to update
     */
    where?: MemoryChunkWhereInput
    /**
     * Limit how many MemoryChunks to update.
     */
    limit?: number
  }

  /**
   * MemoryChunk updateManyAndReturn
   */
  export type MemoryChunkUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * The data used to update MemoryChunks.
     */
    data: XOR<MemoryChunkUpdateManyMutationInput, MemoryChunkUncheckedUpdateManyInput>
    /**
     * Filter which MemoryChunks to update
     */
    where?: MemoryChunkWhereInput
    /**
     * Limit how many MemoryChunks to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * MemoryChunk upsert
   */
  export type MemoryChunkUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
    /**
     * The filter to search for the MemoryChunk to update in case it exists.
     */
    where: MemoryChunkWhereUniqueInput
    /**
     * In case the MemoryChunk found by the `where` argument doesn't exist, create a new MemoryChunk with this data.
     */
    create: XOR<MemoryChunkCreateInput, MemoryChunkUncheckedCreateInput>
    /**
     * In case the MemoryChunk was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MemoryChunkUpdateInput, MemoryChunkUncheckedUpdateInput>
  }

  /**
   * MemoryChunk delete
   */
  export type MemoryChunkDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
    /**
     * Filter which MemoryChunk to delete.
     */
    where: MemoryChunkWhereUniqueInput
  }

  /**
   * MemoryChunk deleteMany
   */
  export type MemoryChunkDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MemoryChunks to delete
     */
    where?: MemoryChunkWhereInput
    /**
     * Limit how many MemoryChunks to delete.
     */
    limit?: number
  }

  /**
   * MemoryChunk.entity_mentions
   */
  export type MemoryChunk$entity_mentionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EntityMention
     */
    select?: EntityMentionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the EntityMention
     */
    omit?: EntityMentionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EntityMentionInclude<ExtArgs> | null
    where?: EntityMentionWhereInput
    orderBy?: EntityMentionOrderByWithRelationInput | EntityMentionOrderByWithRelationInput[]
    cursor?: EntityMentionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EntityMentionScalarFieldEnum | EntityMentionScalarFieldEnum[]
  }

  /**
   * MemoryChunk without action
   */
  export type MemoryChunkDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MemoryChunk
     */
    select?: MemoryChunkSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MemoryChunk
     */
    omit?: MemoryChunkOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MemoryChunkInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const CalendarEventScalarFieldEnum: {
    id: 'id',
    user_id: 'user_id',
    external_id: 'external_id',
    title: 'title',
    start_time: 'start_time',
    end_time: 'end_time',
    diary_entry_id: 'diary_entry_id',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type CalendarEventScalarFieldEnum = (typeof CalendarEventScalarFieldEnum)[keyof typeof CalendarEventScalarFieldEnum]


  export const SummaryScalarFieldEnum: {
    id: 'id',
    user_id: 'user_id',
    summary_type: 'summary_type',
    period_start: 'period_start',
    period_end: 'period_end',
    content: 'content',
    created_at: 'created_at'
  };

  export type SummaryScalarFieldEnum = (typeof SummaryScalarFieldEnum)[keyof typeof SummaryScalarFieldEnum]


  export const EntityMentionScalarFieldEnum: {
    id: 'id',
    chunk_id: 'chunk_id',
    entity_type: 'entity_type',
    entity_value: 'entity_value',
    created_at: 'created_at'
  };

  export type EntityMentionScalarFieldEnum = (typeof EntityMentionScalarFieldEnum)[keyof typeof EntityMentionScalarFieldEnum]


  export const GmailMessageScalarFieldEnum: {
    id: 'id',
    user_id: 'user_id',
    external_id: 'external_id',
    sender: 'sender',
    subject: 'subject',
    body: 'body',
    created_at: 'created_at'
  };

  export type GmailMessageScalarFieldEnum = (typeof GmailMessageScalarFieldEnum)[keyof typeof GmailMessageScalarFieldEnum]


  export const UserScalarFieldEnum: {
    id: 'id',
    supabaseId: 'supabaseId',
    email: 'email',
    display_name: 'display_name',
    google_connected: 'google_connected',
    google_access_token: 'google_access_token',
    google_refresh_token: 'google_refresh_token',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const DiaryEntryScalarFieldEnum: {
    id: 'id',
    user_id: 'user_id',
    entry_date: 'entry_date',
    raw_text: 'raw_text',
    status: 'status',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type DiaryEntryScalarFieldEnum = (typeof DiaryEntryScalarFieldEnum)[keyof typeof DiaryEntryScalarFieldEnum]


  export const AttachmentScalarFieldEnum: {
    id: 'id',
    diary_entry_id: 'diary_entry_id',
    storage_path: 'storage_path',
    file_type: 'file_type',
    extracted_text: 'extracted_text',
    created_at: 'created_at'
  };

  export type AttachmentScalarFieldEnum = (typeof AttachmentScalarFieldEnum)[keyof typeof AttachmentScalarFieldEnum]


  export const MemoryChunkScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    sourceType: 'sourceType',
    sourceId: 'sourceId',
    chunkType: 'chunkType',
    text: 'text',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type MemoryChunkScalarFieldEnum = (typeof MemoryChunkScalarFieldEnum)[keyof typeof MemoryChunkScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    
  /**
   * Deep Input Types
   */


  export type CalendarEventWhereInput = {
    AND?: CalendarEventWhereInput | CalendarEventWhereInput[]
    OR?: CalendarEventWhereInput[]
    NOT?: CalendarEventWhereInput | CalendarEventWhereInput[]
    id?: StringFilter<"CalendarEvent"> | string
    user_id?: StringFilter<"CalendarEvent"> | string
    external_id?: StringFilter<"CalendarEvent"> | string
    title?: StringFilter<"CalendarEvent"> | string
    start_time?: DateTimeFilter<"CalendarEvent"> | Date | string
    end_time?: DateTimeFilter<"CalendarEvent"> | Date | string
    diary_entry_id?: StringNullableFilter<"CalendarEvent"> | string | null
    created_at?: DateTimeFilter<"CalendarEvent"> | Date | string
    updated_at?: DateTimeFilter<"CalendarEvent"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    diary_entry?: XOR<DiaryEntryNullableScalarRelationFilter, DiaryEntryWhereInput> | null
  }

  export type CalendarEventOrderByWithRelationInput = {
    id?: SortOrder
    user_id?: SortOrder
    external_id?: SortOrder
    title?: SortOrder
    start_time?: SortOrder
    end_time?: SortOrder
    diary_entry_id?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    user?: UserOrderByWithRelationInput
    diary_entry?: DiaryEntryOrderByWithRelationInput
  }

  export type CalendarEventWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    external_id?: string
    AND?: CalendarEventWhereInput | CalendarEventWhereInput[]
    OR?: CalendarEventWhereInput[]
    NOT?: CalendarEventWhereInput | CalendarEventWhereInput[]
    user_id?: StringFilter<"CalendarEvent"> | string
    title?: StringFilter<"CalendarEvent"> | string
    start_time?: DateTimeFilter<"CalendarEvent"> | Date | string
    end_time?: DateTimeFilter<"CalendarEvent"> | Date | string
    diary_entry_id?: StringNullableFilter<"CalendarEvent"> | string | null
    created_at?: DateTimeFilter<"CalendarEvent"> | Date | string
    updated_at?: DateTimeFilter<"CalendarEvent"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    diary_entry?: XOR<DiaryEntryNullableScalarRelationFilter, DiaryEntryWhereInput> | null
  }, "id" | "external_id">

  export type CalendarEventOrderByWithAggregationInput = {
    id?: SortOrder
    user_id?: SortOrder
    external_id?: SortOrder
    title?: SortOrder
    start_time?: SortOrder
    end_time?: SortOrder
    diary_entry_id?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    _count?: CalendarEventCountOrderByAggregateInput
    _max?: CalendarEventMaxOrderByAggregateInput
    _min?: CalendarEventMinOrderByAggregateInput
  }

  export type CalendarEventScalarWhereWithAggregatesInput = {
    AND?: CalendarEventScalarWhereWithAggregatesInput | CalendarEventScalarWhereWithAggregatesInput[]
    OR?: CalendarEventScalarWhereWithAggregatesInput[]
    NOT?: CalendarEventScalarWhereWithAggregatesInput | CalendarEventScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CalendarEvent"> | string
    user_id?: StringWithAggregatesFilter<"CalendarEvent"> | string
    external_id?: StringWithAggregatesFilter<"CalendarEvent"> | string
    title?: StringWithAggregatesFilter<"CalendarEvent"> | string
    start_time?: DateTimeWithAggregatesFilter<"CalendarEvent"> | Date | string
    end_time?: DateTimeWithAggregatesFilter<"CalendarEvent"> | Date | string
    diary_entry_id?: StringNullableWithAggregatesFilter<"CalendarEvent"> | string | null
    created_at?: DateTimeWithAggregatesFilter<"CalendarEvent"> | Date | string
    updated_at?: DateTimeWithAggregatesFilter<"CalendarEvent"> | Date | string
  }

  export type SummaryWhereInput = {
    AND?: SummaryWhereInput | SummaryWhereInput[]
    OR?: SummaryWhereInput[]
    NOT?: SummaryWhereInput | SummaryWhereInput[]
    id?: StringFilter<"Summary"> | string
    user_id?: StringFilter<"Summary"> | string
    summary_type?: StringFilter<"Summary"> | string
    period_start?: DateTimeFilter<"Summary"> | Date | string
    period_end?: DateTimeFilter<"Summary"> | Date | string
    content?: StringFilter<"Summary"> | string
    created_at?: DateTimeFilter<"Summary"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type SummaryOrderByWithRelationInput = {
    id?: SortOrder
    user_id?: SortOrder
    summary_type?: SortOrder
    period_start?: SortOrder
    period_end?: SortOrder
    content?: SortOrder
    created_at?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type SummaryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: SummaryWhereInput | SummaryWhereInput[]
    OR?: SummaryWhereInput[]
    NOT?: SummaryWhereInput | SummaryWhereInput[]
    user_id?: StringFilter<"Summary"> | string
    summary_type?: StringFilter<"Summary"> | string
    period_start?: DateTimeFilter<"Summary"> | Date | string
    period_end?: DateTimeFilter<"Summary"> | Date | string
    content?: StringFilter<"Summary"> | string
    created_at?: DateTimeFilter<"Summary"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type SummaryOrderByWithAggregationInput = {
    id?: SortOrder
    user_id?: SortOrder
    summary_type?: SortOrder
    period_start?: SortOrder
    period_end?: SortOrder
    content?: SortOrder
    created_at?: SortOrder
    _count?: SummaryCountOrderByAggregateInput
    _max?: SummaryMaxOrderByAggregateInput
    _min?: SummaryMinOrderByAggregateInput
  }

  export type SummaryScalarWhereWithAggregatesInput = {
    AND?: SummaryScalarWhereWithAggregatesInput | SummaryScalarWhereWithAggregatesInput[]
    OR?: SummaryScalarWhereWithAggregatesInput[]
    NOT?: SummaryScalarWhereWithAggregatesInput | SummaryScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Summary"> | string
    user_id?: StringWithAggregatesFilter<"Summary"> | string
    summary_type?: StringWithAggregatesFilter<"Summary"> | string
    period_start?: DateTimeWithAggregatesFilter<"Summary"> | Date | string
    period_end?: DateTimeWithAggregatesFilter<"Summary"> | Date | string
    content?: StringWithAggregatesFilter<"Summary"> | string
    created_at?: DateTimeWithAggregatesFilter<"Summary"> | Date | string
  }

  export type EntityMentionWhereInput = {
    AND?: EntityMentionWhereInput | EntityMentionWhereInput[]
    OR?: EntityMentionWhereInput[]
    NOT?: EntityMentionWhereInput | EntityMentionWhereInput[]
    id?: StringFilter<"EntityMention"> | string
    chunk_id?: StringFilter<"EntityMention"> | string
    entity_type?: StringFilter<"EntityMention"> | string
    entity_value?: StringFilter<"EntityMention"> | string
    created_at?: DateTimeFilter<"EntityMention"> | Date | string
    chunk?: XOR<MemoryChunkScalarRelationFilter, MemoryChunkWhereInput>
  }

  export type EntityMentionOrderByWithRelationInput = {
    id?: SortOrder
    chunk_id?: SortOrder
    entity_type?: SortOrder
    entity_value?: SortOrder
    created_at?: SortOrder
    chunk?: MemoryChunkOrderByWithRelationInput
  }

  export type EntityMentionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: EntityMentionWhereInput | EntityMentionWhereInput[]
    OR?: EntityMentionWhereInput[]
    NOT?: EntityMentionWhereInput | EntityMentionWhereInput[]
    chunk_id?: StringFilter<"EntityMention"> | string
    entity_type?: StringFilter<"EntityMention"> | string
    entity_value?: StringFilter<"EntityMention"> | string
    created_at?: DateTimeFilter<"EntityMention"> | Date | string
    chunk?: XOR<MemoryChunkScalarRelationFilter, MemoryChunkWhereInput>
  }, "id">

  export type EntityMentionOrderByWithAggregationInput = {
    id?: SortOrder
    chunk_id?: SortOrder
    entity_type?: SortOrder
    entity_value?: SortOrder
    created_at?: SortOrder
    _count?: EntityMentionCountOrderByAggregateInput
    _max?: EntityMentionMaxOrderByAggregateInput
    _min?: EntityMentionMinOrderByAggregateInput
  }

  export type EntityMentionScalarWhereWithAggregatesInput = {
    AND?: EntityMentionScalarWhereWithAggregatesInput | EntityMentionScalarWhereWithAggregatesInput[]
    OR?: EntityMentionScalarWhereWithAggregatesInput[]
    NOT?: EntityMentionScalarWhereWithAggregatesInput | EntityMentionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"EntityMention"> | string
    chunk_id?: StringWithAggregatesFilter<"EntityMention"> | string
    entity_type?: StringWithAggregatesFilter<"EntityMention"> | string
    entity_value?: StringWithAggregatesFilter<"EntityMention"> | string
    created_at?: DateTimeWithAggregatesFilter<"EntityMention"> | Date | string
  }

  export type GmailMessageWhereInput = {
    AND?: GmailMessageWhereInput | GmailMessageWhereInput[]
    OR?: GmailMessageWhereInput[]
    NOT?: GmailMessageWhereInput | GmailMessageWhereInput[]
    id?: StringFilter<"GmailMessage"> | string
    user_id?: StringFilter<"GmailMessage"> | string
    external_id?: StringFilter<"GmailMessage"> | string
    sender?: StringFilter<"GmailMessage"> | string
    subject?: StringFilter<"GmailMessage"> | string
    body?: StringFilter<"GmailMessage"> | string
    created_at?: DateTimeFilter<"GmailMessage"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type GmailMessageOrderByWithRelationInput = {
    id?: SortOrder
    user_id?: SortOrder
    external_id?: SortOrder
    sender?: SortOrder
    subject?: SortOrder
    body?: SortOrder
    created_at?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type GmailMessageWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    external_id?: string
    AND?: GmailMessageWhereInput | GmailMessageWhereInput[]
    OR?: GmailMessageWhereInput[]
    NOT?: GmailMessageWhereInput | GmailMessageWhereInput[]
    user_id?: StringFilter<"GmailMessage"> | string
    sender?: StringFilter<"GmailMessage"> | string
    subject?: StringFilter<"GmailMessage"> | string
    body?: StringFilter<"GmailMessage"> | string
    created_at?: DateTimeFilter<"GmailMessage"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "external_id">

  export type GmailMessageOrderByWithAggregationInput = {
    id?: SortOrder
    user_id?: SortOrder
    external_id?: SortOrder
    sender?: SortOrder
    subject?: SortOrder
    body?: SortOrder
    created_at?: SortOrder
    _count?: GmailMessageCountOrderByAggregateInput
    _max?: GmailMessageMaxOrderByAggregateInput
    _min?: GmailMessageMinOrderByAggregateInput
  }

  export type GmailMessageScalarWhereWithAggregatesInput = {
    AND?: GmailMessageScalarWhereWithAggregatesInput | GmailMessageScalarWhereWithAggregatesInput[]
    OR?: GmailMessageScalarWhereWithAggregatesInput[]
    NOT?: GmailMessageScalarWhereWithAggregatesInput | GmailMessageScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"GmailMessage"> | string
    user_id?: StringWithAggregatesFilter<"GmailMessage"> | string
    external_id?: StringWithAggregatesFilter<"GmailMessage"> | string
    sender?: StringWithAggregatesFilter<"GmailMessage"> | string
    subject?: StringWithAggregatesFilter<"GmailMessage"> | string
    body?: StringWithAggregatesFilter<"GmailMessage"> | string
    created_at?: DateTimeWithAggregatesFilter<"GmailMessage"> | Date | string
  }

  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    supabaseId?: UuidFilter<"User"> | string
    email?: StringFilter<"User"> | string
    display_name?: StringNullableFilter<"User"> | string | null
    google_connected?: BoolFilter<"User"> | boolean
    google_access_token?: StringNullableFilter<"User"> | string | null
    google_refresh_token?: StringNullableFilter<"User"> | string | null
    created_at?: DateTimeFilter<"User"> | Date | string
    updated_at?: DateTimeFilter<"User"> | Date | string
    diary_entries?: DiaryEntryListRelationFilter
    memory_chunks?: MemoryChunkListRelationFilter
    summaries?: SummaryListRelationFilter
    calendar_events?: CalendarEventListRelationFilter
    gmail_messages?: GmailMessageListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    supabaseId?: SortOrder
    email?: SortOrder
    display_name?: SortOrderInput | SortOrder
    google_connected?: SortOrder
    google_access_token?: SortOrderInput | SortOrder
    google_refresh_token?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    diary_entries?: DiaryEntryOrderByRelationAggregateInput
    memory_chunks?: MemoryChunkOrderByRelationAggregateInput
    summaries?: SummaryOrderByRelationAggregateInput
    calendar_events?: CalendarEventOrderByRelationAggregateInput
    gmail_messages?: GmailMessageOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    supabaseId?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    display_name?: StringNullableFilter<"User"> | string | null
    google_connected?: BoolFilter<"User"> | boolean
    google_access_token?: StringNullableFilter<"User"> | string | null
    google_refresh_token?: StringNullableFilter<"User"> | string | null
    created_at?: DateTimeFilter<"User"> | Date | string
    updated_at?: DateTimeFilter<"User"> | Date | string
    diary_entries?: DiaryEntryListRelationFilter
    memory_chunks?: MemoryChunkListRelationFilter
    summaries?: SummaryListRelationFilter
    calendar_events?: CalendarEventListRelationFilter
    gmail_messages?: GmailMessageListRelationFilter
  }, "id" | "supabaseId" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    supabaseId?: SortOrder
    email?: SortOrder
    display_name?: SortOrderInput | SortOrder
    google_connected?: SortOrder
    google_access_token?: SortOrderInput | SortOrder
    google_refresh_token?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    supabaseId?: UuidWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    display_name?: StringNullableWithAggregatesFilter<"User"> | string | null
    google_connected?: BoolWithAggregatesFilter<"User"> | boolean
    google_access_token?: StringNullableWithAggregatesFilter<"User"> | string | null
    google_refresh_token?: StringNullableWithAggregatesFilter<"User"> | string | null
    created_at?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updated_at?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type DiaryEntryWhereInput = {
    AND?: DiaryEntryWhereInput | DiaryEntryWhereInput[]
    OR?: DiaryEntryWhereInput[]
    NOT?: DiaryEntryWhereInput | DiaryEntryWhereInput[]
    id?: StringFilter<"DiaryEntry"> | string
    user_id?: StringFilter<"DiaryEntry"> | string
    entry_date?: DateTimeFilter<"DiaryEntry"> | Date | string
    raw_text?: StringFilter<"DiaryEntry"> | string
    status?: StringFilter<"DiaryEntry"> | string
    created_at?: DateTimeFilter<"DiaryEntry"> | Date | string
    updated_at?: DateTimeFilter<"DiaryEntry"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    attachments?: AttachmentListRelationFilter
    calendar_events?: CalendarEventListRelationFilter
  }

  export type DiaryEntryOrderByWithRelationInput = {
    id?: SortOrder
    user_id?: SortOrder
    entry_date?: SortOrder
    raw_text?: SortOrder
    status?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    user?: UserOrderByWithRelationInput
    attachments?: AttachmentOrderByRelationAggregateInput
    calendar_events?: CalendarEventOrderByRelationAggregateInput
  }

  export type DiaryEntryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: DiaryEntryWhereInput | DiaryEntryWhereInput[]
    OR?: DiaryEntryWhereInput[]
    NOT?: DiaryEntryWhereInput | DiaryEntryWhereInput[]
    user_id?: StringFilter<"DiaryEntry"> | string
    entry_date?: DateTimeFilter<"DiaryEntry"> | Date | string
    raw_text?: StringFilter<"DiaryEntry"> | string
    status?: StringFilter<"DiaryEntry"> | string
    created_at?: DateTimeFilter<"DiaryEntry"> | Date | string
    updated_at?: DateTimeFilter<"DiaryEntry"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    attachments?: AttachmentListRelationFilter
    calendar_events?: CalendarEventListRelationFilter
  }, "id">

  export type DiaryEntryOrderByWithAggregationInput = {
    id?: SortOrder
    user_id?: SortOrder
    entry_date?: SortOrder
    raw_text?: SortOrder
    status?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    _count?: DiaryEntryCountOrderByAggregateInput
    _max?: DiaryEntryMaxOrderByAggregateInput
    _min?: DiaryEntryMinOrderByAggregateInput
  }

  export type DiaryEntryScalarWhereWithAggregatesInput = {
    AND?: DiaryEntryScalarWhereWithAggregatesInput | DiaryEntryScalarWhereWithAggregatesInput[]
    OR?: DiaryEntryScalarWhereWithAggregatesInput[]
    NOT?: DiaryEntryScalarWhereWithAggregatesInput | DiaryEntryScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"DiaryEntry"> | string
    user_id?: StringWithAggregatesFilter<"DiaryEntry"> | string
    entry_date?: DateTimeWithAggregatesFilter<"DiaryEntry"> | Date | string
    raw_text?: StringWithAggregatesFilter<"DiaryEntry"> | string
    status?: StringWithAggregatesFilter<"DiaryEntry"> | string
    created_at?: DateTimeWithAggregatesFilter<"DiaryEntry"> | Date | string
    updated_at?: DateTimeWithAggregatesFilter<"DiaryEntry"> | Date | string
  }

  export type AttachmentWhereInput = {
    AND?: AttachmentWhereInput | AttachmentWhereInput[]
    OR?: AttachmentWhereInput[]
    NOT?: AttachmentWhereInput | AttachmentWhereInput[]
    id?: StringFilter<"Attachment"> | string
    diary_entry_id?: StringFilter<"Attachment"> | string
    storage_path?: StringFilter<"Attachment"> | string
    file_type?: StringFilter<"Attachment"> | string
    extracted_text?: StringNullableFilter<"Attachment"> | string | null
    created_at?: DateTimeFilter<"Attachment"> | Date | string
    diary_entry?: XOR<DiaryEntryScalarRelationFilter, DiaryEntryWhereInput>
  }

  export type AttachmentOrderByWithRelationInput = {
    id?: SortOrder
    diary_entry_id?: SortOrder
    storage_path?: SortOrder
    file_type?: SortOrder
    extracted_text?: SortOrderInput | SortOrder
    created_at?: SortOrder
    diary_entry?: DiaryEntryOrderByWithRelationInput
  }

  export type AttachmentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AttachmentWhereInput | AttachmentWhereInput[]
    OR?: AttachmentWhereInput[]
    NOT?: AttachmentWhereInput | AttachmentWhereInput[]
    diary_entry_id?: StringFilter<"Attachment"> | string
    storage_path?: StringFilter<"Attachment"> | string
    file_type?: StringFilter<"Attachment"> | string
    extracted_text?: StringNullableFilter<"Attachment"> | string | null
    created_at?: DateTimeFilter<"Attachment"> | Date | string
    diary_entry?: XOR<DiaryEntryScalarRelationFilter, DiaryEntryWhereInput>
  }, "id">

  export type AttachmentOrderByWithAggregationInput = {
    id?: SortOrder
    diary_entry_id?: SortOrder
    storage_path?: SortOrder
    file_type?: SortOrder
    extracted_text?: SortOrderInput | SortOrder
    created_at?: SortOrder
    _count?: AttachmentCountOrderByAggregateInput
    _max?: AttachmentMaxOrderByAggregateInput
    _min?: AttachmentMinOrderByAggregateInput
  }

  export type AttachmentScalarWhereWithAggregatesInput = {
    AND?: AttachmentScalarWhereWithAggregatesInput | AttachmentScalarWhereWithAggregatesInput[]
    OR?: AttachmentScalarWhereWithAggregatesInput[]
    NOT?: AttachmentScalarWhereWithAggregatesInput | AttachmentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Attachment"> | string
    diary_entry_id?: StringWithAggregatesFilter<"Attachment"> | string
    storage_path?: StringWithAggregatesFilter<"Attachment"> | string
    file_type?: StringWithAggregatesFilter<"Attachment"> | string
    extracted_text?: StringNullableWithAggregatesFilter<"Attachment"> | string | null
    created_at?: DateTimeWithAggregatesFilter<"Attachment"> | Date | string
  }

  export type MemoryChunkWhereInput = {
    AND?: MemoryChunkWhereInput | MemoryChunkWhereInput[]
    OR?: MemoryChunkWhereInput[]
    NOT?: MemoryChunkWhereInput | MemoryChunkWhereInput[]
    id?: StringFilter<"MemoryChunk"> | string
    userId?: StringFilter<"MemoryChunk"> | string
    sourceType?: StringFilter<"MemoryChunk"> | string
    sourceId?: StringFilter<"MemoryChunk"> | string
    chunkType?: StringFilter<"MemoryChunk"> | string
    text?: StringFilter<"MemoryChunk"> | string
    metadata?: JsonNullableFilter<"MemoryChunk">
    createdAt?: DateTimeFilter<"MemoryChunk"> | Date | string
    updatedAt?: DateTimeFilter<"MemoryChunk"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    entity_mentions?: EntityMentionListRelationFilter
  }

  export type MemoryChunkOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    sourceType?: SortOrder
    sourceId?: SortOrder
    chunkType?: SortOrder
    text?: SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    entity_mentions?: EntityMentionOrderByRelationAggregateInput
  }

  export type MemoryChunkWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: MemoryChunkWhereInput | MemoryChunkWhereInput[]
    OR?: MemoryChunkWhereInput[]
    NOT?: MemoryChunkWhereInput | MemoryChunkWhereInput[]
    userId?: StringFilter<"MemoryChunk"> | string
    sourceType?: StringFilter<"MemoryChunk"> | string
    sourceId?: StringFilter<"MemoryChunk"> | string
    chunkType?: StringFilter<"MemoryChunk"> | string
    text?: StringFilter<"MemoryChunk"> | string
    metadata?: JsonNullableFilter<"MemoryChunk">
    createdAt?: DateTimeFilter<"MemoryChunk"> | Date | string
    updatedAt?: DateTimeFilter<"MemoryChunk"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    entity_mentions?: EntityMentionListRelationFilter
  }, "id">

  export type MemoryChunkOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    sourceType?: SortOrder
    sourceId?: SortOrder
    chunkType?: SortOrder
    text?: SortOrder
    metadata?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: MemoryChunkCountOrderByAggregateInput
    _max?: MemoryChunkMaxOrderByAggregateInput
    _min?: MemoryChunkMinOrderByAggregateInput
  }

  export type MemoryChunkScalarWhereWithAggregatesInput = {
    AND?: MemoryChunkScalarWhereWithAggregatesInput | MemoryChunkScalarWhereWithAggregatesInput[]
    OR?: MemoryChunkScalarWhereWithAggregatesInput[]
    NOT?: MemoryChunkScalarWhereWithAggregatesInput | MemoryChunkScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MemoryChunk"> | string
    userId?: StringWithAggregatesFilter<"MemoryChunk"> | string
    sourceType?: StringWithAggregatesFilter<"MemoryChunk"> | string
    sourceId?: StringWithAggregatesFilter<"MemoryChunk"> | string
    chunkType?: StringWithAggregatesFilter<"MemoryChunk"> | string
    text?: StringWithAggregatesFilter<"MemoryChunk"> | string
    metadata?: JsonNullableWithAggregatesFilter<"MemoryChunk">
    createdAt?: DateTimeWithAggregatesFilter<"MemoryChunk"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"MemoryChunk"> | Date | string
  }

  export type CalendarEventCreateInput = {
    id?: string
    external_id: string
    title: string
    start_time: Date | string
    end_time: Date | string
    created_at?: Date | string
    updated_at?: Date | string
    user: UserCreateNestedOneWithoutCalendar_eventsInput
    diary_entry?: DiaryEntryCreateNestedOneWithoutCalendar_eventsInput
  }

  export type CalendarEventUncheckedCreateInput = {
    id?: string
    user_id: string
    external_id: string
    title: string
    start_time: Date | string
    end_time: Date | string
    diary_entry_id?: string | null
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type CalendarEventUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    start_time?: DateTimeFieldUpdateOperationsInput | Date | string
    end_time?: DateTimeFieldUpdateOperationsInput | Date | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutCalendar_eventsNestedInput
    diary_entry?: DiaryEntryUpdateOneWithoutCalendar_eventsNestedInput
  }

  export type CalendarEventUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    start_time?: DateTimeFieldUpdateOperationsInput | Date | string
    end_time?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entry_id?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CalendarEventCreateManyInput = {
    id?: string
    user_id: string
    external_id: string
    title: string
    start_time: Date | string
    end_time: Date | string
    diary_entry_id?: string | null
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type CalendarEventUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    start_time?: DateTimeFieldUpdateOperationsInput | Date | string
    end_time?: DateTimeFieldUpdateOperationsInput | Date | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CalendarEventUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    start_time?: DateTimeFieldUpdateOperationsInput | Date | string
    end_time?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entry_id?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SummaryCreateInput = {
    id?: string
    summary_type: string
    period_start: Date | string
    period_end: Date | string
    content: string
    created_at?: Date | string
    user: UserCreateNestedOneWithoutSummariesInput
  }

  export type SummaryUncheckedCreateInput = {
    id?: string
    user_id: string
    summary_type: string
    period_start: Date | string
    period_end: Date | string
    content: string
    created_at?: Date | string
  }

  export type SummaryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    summary_type?: StringFieldUpdateOperationsInput | string
    period_start?: DateTimeFieldUpdateOperationsInput | Date | string
    period_end?: DateTimeFieldUpdateOperationsInput | Date | string
    content?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSummariesNestedInput
  }

  export type SummaryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    summary_type?: StringFieldUpdateOperationsInput | string
    period_start?: DateTimeFieldUpdateOperationsInput | Date | string
    period_end?: DateTimeFieldUpdateOperationsInput | Date | string
    content?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SummaryCreateManyInput = {
    id?: string
    user_id: string
    summary_type: string
    period_start: Date | string
    period_end: Date | string
    content: string
    created_at?: Date | string
  }

  export type SummaryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    summary_type?: StringFieldUpdateOperationsInput | string
    period_start?: DateTimeFieldUpdateOperationsInput | Date | string
    period_end?: DateTimeFieldUpdateOperationsInput | Date | string
    content?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SummaryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    summary_type?: StringFieldUpdateOperationsInput | string
    period_start?: DateTimeFieldUpdateOperationsInput | Date | string
    period_end?: DateTimeFieldUpdateOperationsInput | Date | string
    content?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EntityMentionCreateInput = {
    id?: string
    entity_type: string
    entity_value: string
    created_at?: Date | string
    chunk: MemoryChunkCreateNestedOneWithoutEntity_mentionsInput
  }

  export type EntityMentionUncheckedCreateInput = {
    id?: string
    chunk_id: string
    entity_type: string
    entity_value: string
    created_at?: Date | string
  }

  export type EntityMentionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    entity_type?: StringFieldUpdateOperationsInput | string
    entity_value?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    chunk?: MemoryChunkUpdateOneRequiredWithoutEntity_mentionsNestedInput
  }

  export type EntityMentionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    chunk_id?: StringFieldUpdateOperationsInput | string
    entity_type?: StringFieldUpdateOperationsInput | string
    entity_value?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EntityMentionCreateManyInput = {
    id?: string
    chunk_id: string
    entity_type: string
    entity_value: string
    created_at?: Date | string
  }

  export type EntityMentionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    entity_type?: StringFieldUpdateOperationsInput | string
    entity_value?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EntityMentionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    chunk_id?: StringFieldUpdateOperationsInput | string
    entity_type?: StringFieldUpdateOperationsInput | string
    entity_value?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GmailMessageCreateInput = {
    id?: string
    external_id: string
    sender: string
    subject: string
    body: string
    created_at?: Date | string
    user: UserCreateNestedOneWithoutGmail_messagesInput
  }

  export type GmailMessageUncheckedCreateInput = {
    id?: string
    user_id: string
    external_id: string
    sender: string
    subject: string
    body: string
    created_at?: Date | string
  }

  export type GmailMessageUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    subject?: StringFieldUpdateOperationsInput | string
    body?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutGmail_messagesNestedInput
  }

  export type GmailMessageUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    subject?: StringFieldUpdateOperationsInput | string
    body?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GmailMessageCreateManyInput = {
    id?: string
    user_id: string
    external_id: string
    sender: string
    subject: string
    body: string
    created_at?: Date | string
  }

  export type GmailMessageUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    subject?: StringFieldUpdateOperationsInput | string
    body?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GmailMessageUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    subject?: StringFieldUpdateOperationsInput | string
    body?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    diary_entries?: DiaryEntryCreateNestedManyWithoutUserInput
    memory_chunks?: MemoryChunkCreateNestedManyWithoutUserInput
    summaries?: SummaryCreateNestedManyWithoutUserInput
    calendar_events?: CalendarEventCreateNestedManyWithoutUserInput
    gmail_messages?: GmailMessageCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    diary_entries?: DiaryEntryUncheckedCreateNestedManyWithoutUserInput
    memory_chunks?: MemoryChunkUncheckedCreateNestedManyWithoutUserInput
    summaries?: SummaryUncheckedCreateNestedManyWithoutUserInput
    calendar_events?: CalendarEventUncheckedCreateNestedManyWithoutUserInput
    gmail_messages?: GmailMessageUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entries?: DiaryEntryUpdateManyWithoutUserNestedInput
    memory_chunks?: MemoryChunkUpdateManyWithoutUserNestedInput
    summaries?: SummaryUpdateManyWithoutUserNestedInput
    calendar_events?: CalendarEventUpdateManyWithoutUserNestedInput
    gmail_messages?: GmailMessageUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entries?: DiaryEntryUncheckedUpdateManyWithoutUserNestedInput
    memory_chunks?: MemoryChunkUncheckedUpdateManyWithoutUserNestedInput
    summaries?: SummaryUncheckedUpdateManyWithoutUserNestedInput
    calendar_events?: CalendarEventUncheckedUpdateManyWithoutUserNestedInput
    gmail_messages?: GmailMessageUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DiaryEntryCreateInput = {
    id?: string
    entry_date?: Date | string
    raw_text: string
    status?: string
    created_at?: Date | string
    updated_at?: Date | string
    user: UserCreateNestedOneWithoutDiary_entriesInput
    attachments?: AttachmentCreateNestedManyWithoutDiary_entryInput
    calendar_events?: CalendarEventCreateNestedManyWithoutDiary_entryInput
  }

  export type DiaryEntryUncheckedCreateInput = {
    id?: string
    user_id: string
    entry_date?: Date | string
    raw_text: string
    status?: string
    created_at?: Date | string
    updated_at?: Date | string
    attachments?: AttachmentUncheckedCreateNestedManyWithoutDiary_entryInput
    calendar_events?: CalendarEventUncheckedCreateNestedManyWithoutDiary_entryInput
  }

  export type DiaryEntryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutDiary_entriesNestedInput
    attachments?: AttachmentUpdateManyWithoutDiary_entryNestedInput
    calendar_events?: CalendarEventUpdateManyWithoutDiary_entryNestedInput
  }

  export type DiaryEntryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    attachments?: AttachmentUncheckedUpdateManyWithoutDiary_entryNestedInput
    calendar_events?: CalendarEventUncheckedUpdateManyWithoutDiary_entryNestedInput
  }

  export type DiaryEntryCreateManyInput = {
    id?: string
    user_id: string
    entry_date?: Date | string
    raw_text: string
    status?: string
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type DiaryEntryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DiaryEntryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AttachmentCreateInput = {
    id?: string
    storage_path: string
    file_type: string
    extracted_text?: string | null
    created_at?: Date | string
    diary_entry: DiaryEntryCreateNestedOneWithoutAttachmentsInput
  }

  export type AttachmentUncheckedCreateInput = {
    id?: string
    diary_entry_id: string
    storage_path: string
    file_type: string
    extracted_text?: string | null
    created_at?: Date | string
  }

  export type AttachmentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    storage_path?: StringFieldUpdateOperationsInput | string
    file_type?: StringFieldUpdateOperationsInput | string
    extracted_text?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entry?: DiaryEntryUpdateOneRequiredWithoutAttachmentsNestedInput
  }

  export type AttachmentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    diary_entry_id?: StringFieldUpdateOperationsInput | string
    storage_path?: StringFieldUpdateOperationsInput | string
    file_type?: StringFieldUpdateOperationsInput | string
    extracted_text?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AttachmentCreateManyInput = {
    id?: string
    diary_entry_id: string
    storage_path: string
    file_type: string
    extracted_text?: string | null
    created_at?: Date | string
  }

  export type AttachmentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    storage_path?: StringFieldUpdateOperationsInput | string
    file_type?: StringFieldUpdateOperationsInput | string
    extracted_text?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AttachmentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    diary_entry_id?: StringFieldUpdateOperationsInput | string
    storage_path?: StringFieldUpdateOperationsInput | string
    file_type?: StringFieldUpdateOperationsInput | string
    extracted_text?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MemoryChunkCreateInput = {
    id?: string
    sourceType: string
    sourceId: string
    chunkType?: string
    text: string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutMemory_chunksInput
    entity_mentions?: EntityMentionCreateNestedManyWithoutChunkInput
  }

  export type MemoryChunkUncheckedCreateInput = {
    id?: string
    userId: string
    sourceType: string
    sourceId: string
    chunkType?: string
    text: string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    entity_mentions?: EntityMentionUncheckedCreateNestedManyWithoutChunkInput
  }

  export type MemoryChunkUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    chunkType?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutMemory_chunksNestedInput
    entity_mentions?: EntityMentionUpdateManyWithoutChunkNestedInput
  }

  export type MemoryChunkUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    chunkType?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    entity_mentions?: EntityMentionUncheckedUpdateManyWithoutChunkNestedInput
  }

  export type MemoryChunkCreateManyInput = {
    id?: string
    userId: string
    sourceType: string
    sourceId: string
    chunkType?: string
    text: string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MemoryChunkUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    chunkType?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MemoryChunkUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    chunkType?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type DiaryEntryNullableScalarRelationFilter = {
    is?: DiaryEntryWhereInput | null
    isNot?: DiaryEntryWhereInput | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type CalendarEventCountOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    external_id?: SortOrder
    title?: SortOrder
    start_time?: SortOrder
    end_time?: SortOrder
    diary_entry_id?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type CalendarEventMaxOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    external_id?: SortOrder
    title?: SortOrder
    start_time?: SortOrder
    end_time?: SortOrder
    diary_entry_id?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type CalendarEventMinOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    external_id?: SortOrder
    title?: SortOrder
    start_time?: SortOrder
    end_time?: SortOrder
    diary_entry_id?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type SummaryCountOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    summary_type?: SortOrder
    period_start?: SortOrder
    period_end?: SortOrder
    content?: SortOrder
    created_at?: SortOrder
  }

  export type SummaryMaxOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    summary_type?: SortOrder
    period_start?: SortOrder
    period_end?: SortOrder
    content?: SortOrder
    created_at?: SortOrder
  }

  export type SummaryMinOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    summary_type?: SortOrder
    period_start?: SortOrder
    period_end?: SortOrder
    content?: SortOrder
    created_at?: SortOrder
  }

  export type MemoryChunkScalarRelationFilter = {
    is?: MemoryChunkWhereInput
    isNot?: MemoryChunkWhereInput
  }

  export type EntityMentionCountOrderByAggregateInput = {
    id?: SortOrder
    chunk_id?: SortOrder
    entity_type?: SortOrder
    entity_value?: SortOrder
    created_at?: SortOrder
  }

  export type EntityMentionMaxOrderByAggregateInput = {
    id?: SortOrder
    chunk_id?: SortOrder
    entity_type?: SortOrder
    entity_value?: SortOrder
    created_at?: SortOrder
  }

  export type EntityMentionMinOrderByAggregateInput = {
    id?: SortOrder
    chunk_id?: SortOrder
    entity_type?: SortOrder
    entity_value?: SortOrder
    created_at?: SortOrder
  }

  export type GmailMessageCountOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    external_id?: SortOrder
    sender?: SortOrder
    subject?: SortOrder
    body?: SortOrder
    created_at?: SortOrder
  }

  export type GmailMessageMaxOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    external_id?: SortOrder
    sender?: SortOrder
    subject?: SortOrder
    body?: SortOrder
    created_at?: SortOrder
  }

  export type GmailMessageMinOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    external_id?: SortOrder
    sender?: SortOrder
    subject?: SortOrder
    body?: SortOrder
    created_at?: SortOrder
  }

  export type UuidFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedUuidFilter<$PrismaModel> | string
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DiaryEntryListRelationFilter = {
    every?: DiaryEntryWhereInput
    some?: DiaryEntryWhereInput
    none?: DiaryEntryWhereInput
  }

  export type MemoryChunkListRelationFilter = {
    every?: MemoryChunkWhereInput
    some?: MemoryChunkWhereInput
    none?: MemoryChunkWhereInput
  }

  export type SummaryListRelationFilter = {
    every?: SummaryWhereInput
    some?: SummaryWhereInput
    none?: SummaryWhereInput
  }

  export type CalendarEventListRelationFilter = {
    every?: CalendarEventWhereInput
    some?: CalendarEventWhereInput
    none?: CalendarEventWhereInput
  }

  export type GmailMessageListRelationFilter = {
    every?: GmailMessageWhereInput
    some?: GmailMessageWhereInput
    none?: GmailMessageWhereInput
  }

  export type DiaryEntryOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type MemoryChunkOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type SummaryOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CalendarEventOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type GmailMessageOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    supabaseId?: SortOrder
    email?: SortOrder
    display_name?: SortOrder
    google_connected?: SortOrder
    google_access_token?: SortOrder
    google_refresh_token?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    supabaseId?: SortOrder
    email?: SortOrder
    display_name?: SortOrder
    google_connected?: SortOrder
    google_access_token?: SortOrder
    google_refresh_token?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    supabaseId?: SortOrder
    email?: SortOrder
    display_name?: SortOrder
    google_connected?: SortOrder
    google_access_token?: SortOrder
    google_refresh_token?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type UuidWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedUuidWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type AttachmentListRelationFilter = {
    every?: AttachmentWhereInput
    some?: AttachmentWhereInput
    none?: AttachmentWhereInput
  }

  export type AttachmentOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type DiaryEntryCountOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    entry_date?: SortOrder
    raw_text?: SortOrder
    status?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type DiaryEntryMaxOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    entry_date?: SortOrder
    raw_text?: SortOrder
    status?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type DiaryEntryMinOrderByAggregateInput = {
    id?: SortOrder
    user_id?: SortOrder
    entry_date?: SortOrder
    raw_text?: SortOrder
    status?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type DiaryEntryScalarRelationFilter = {
    is?: DiaryEntryWhereInput
    isNot?: DiaryEntryWhereInput
  }

  export type AttachmentCountOrderByAggregateInput = {
    id?: SortOrder
    diary_entry_id?: SortOrder
    storage_path?: SortOrder
    file_type?: SortOrder
    extracted_text?: SortOrder
    created_at?: SortOrder
  }

  export type AttachmentMaxOrderByAggregateInput = {
    id?: SortOrder
    diary_entry_id?: SortOrder
    storage_path?: SortOrder
    file_type?: SortOrder
    extracted_text?: SortOrder
    created_at?: SortOrder
  }

  export type AttachmentMinOrderByAggregateInput = {
    id?: SortOrder
    diary_entry_id?: SortOrder
    storage_path?: SortOrder
    file_type?: SortOrder
    extracted_text?: SortOrder
    created_at?: SortOrder
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type EntityMentionListRelationFilter = {
    every?: EntityMentionWhereInput
    some?: EntityMentionWhereInput
    none?: EntityMentionWhereInput
  }

  export type EntityMentionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type MemoryChunkCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    sourceType?: SortOrder
    sourceId?: SortOrder
    chunkType?: SortOrder
    text?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MemoryChunkMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    sourceType?: SortOrder
    sourceId?: SortOrder
    chunkType?: SortOrder
    text?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MemoryChunkMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    sourceType?: SortOrder
    sourceId?: SortOrder
    chunkType?: SortOrder
    text?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type UserCreateNestedOneWithoutCalendar_eventsInput = {
    create?: XOR<UserCreateWithoutCalendar_eventsInput, UserUncheckedCreateWithoutCalendar_eventsInput>
    connectOrCreate?: UserCreateOrConnectWithoutCalendar_eventsInput
    connect?: UserWhereUniqueInput
  }

  export type DiaryEntryCreateNestedOneWithoutCalendar_eventsInput = {
    create?: XOR<DiaryEntryCreateWithoutCalendar_eventsInput, DiaryEntryUncheckedCreateWithoutCalendar_eventsInput>
    connectOrCreate?: DiaryEntryCreateOrConnectWithoutCalendar_eventsInput
    connect?: DiaryEntryWhereUniqueInput
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type UserUpdateOneRequiredWithoutCalendar_eventsNestedInput = {
    create?: XOR<UserCreateWithoutCalendar_eventsInput, UserUncheckedCreateWithoutCalendar_eventsInput>
    connectOrCreate?: UserCreateOrConnectWithoutCalendar_eventsInput
    upsert?: UserUpsertWithoutCalendar_eventsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutCalendar_eventsInput, UserUpdateWithoutCalendar_eventsInput>, UserUncheckedUpdateWithoutCalendar_eventsInput>
  }

  export type DiaryEntryUpdateOneWithoutCalendar_eventsNestedInput = {
    create?: XOR<DiaryEntryCreateWithoutCalendar_eventsInput, DiaryEntryUncheckedCreateWithoutCalendar_eventsInput>
    connectOrCreate?: DiaryEntryCreateOrConnectWithoutCalendar_eventsInput
    upsert?: DiaryEntryUpsertWithoutCalendar_eventsInput
    disconnect?: DiaryEntryWhereInput | boolean
    delete?: DiaryEntryWhereInput | boolean
    connect?: DiaryEntryWhereUniqueInput
    update?: XOR<XOR<DiaryEntryUpdateToOneWithWhereWithoutCalendar_eventsInput, DiaryEntryUpdateWithoutCalendar_eventsInput>, DiaryEntryUncheckedUpdateWithoutCalendar_eventsInput>
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type UserCreateNestedOneWithoutSummariesInput = {
    create?: XOR<UserCreateWithoutSummariesInput, UserUncheckedCreateWithoutSummariesInput>
    connectOrCreate?: UserCreateOrConnectWithoutSummariesInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutSummariesNestedInput = {
    create?: XOR<UserCreateWithoutSummariesInput, UserUncheckedCreateWithoutSummariesInput>
    connectOrCreate?: UserCreateOrConnectWithoutSummariesInput
    upsert?: UserUpsertWithoutSummariesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSummariesInput, UserUpdateWithoutSummariesInput>, UserUncheckedUpdateWithoutSummariesInput>
  }

  export type MemoryChunkCreateNestedOneWithoutEntity_mentionsInput = {
    create?: XOR<MemoryChunkCreateWithoutEntity_mentionsInput, MemoryChunkUncheckedCreateWithoutEntity_mentionsInput>
    connectOrCreate?: MemoryChunkCreateOrConnectWithoutEntity_mentionsInput
    connect?: MemoryChunkWhereUniqueInput
  }

  export type MemoryChunkUpdateOneRequiredWithoutEntity_mentionsNestedInput = {
    create?: XOR<MemoryChunkCreateWithoutEntity_mentionsInput, MemoryChunkUncheckedCreateWithoutEntity_mentionsInput>
    connectOrCreate?: MemoryChunkCreateOrConnectWithoutEntity_mentionsInput
    upsert?: MemoryChunkUpsertWithoutEntity_mentionsInput
    connect?: MemoryChunkWhereUniqueInput
    update?: XOR<XOR<MemoryChunkUpdateToOneWithWhereWithoutEntity_mentionsInput, MemoryChunkUpdateWithoutEntity_mentionsInput>, MemoryChunkUncheckedUpdateWithoutEntity_mentionsInput>
  }

  export type UserCreateNestedOneWithoutGmail_messagesInput = {
    create?: XOR<UserCreateWithoutGmail_messagesInput, UserUncheckedCreateWithoutGmail_messagesInput>
    connectOrCreate?: UserCreateOrConnectWithoutGmail_messagesInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutGmail_messagesNestedInput = {
    create?: XOR<UserCreateWithoutGmail_messagesInput, UserUncheckedCreateWithoutGmail_messagesInput>
    connectOrCreate?: UserCreateOrConnectWithoutGmail_messagesInput
    upsert?: UserUpsertWithoutGmail_messagesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutGmail_messagesInput, UserUpdateWithoutGmail_messagesInput>, UserUncheckedUpdateWithoutGmail_messagesInput>
  }

  export type DiaryEntryCreateNestedManyWithoutUserInput = {
    create?: XOR<DiaryEntryCreateWithoutUserInput, DiaryEntryUncheckedCreateWithoutUserInput> | DiaryEntryCreateWithoutUserInput[] | DiaryEntryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DiaryEntryCreateOrConnectWithoutUserInput | DiaryEntryCreateOrConnectWithoutUserInput[]
    createMany?: DiaryEntryCreateManyUserInputEnvelope
    connect?: DiaryEntryWhereUniqueInput | DiaryEntryWhereUniqueInput[]
  }

  export type MemoryChunkCreateNestedManyWithoutUserInput = {
    create?: XOR<MemoryChunkCreateWithoutUserInput, MemoryChunkUncheckedCreateWithoutUserInput> | MemoryChunkCreateWithoutUserInput[] | MemoryChunkUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MemoryChunkCreateOrConnectWithoutUserInput | MemoryChunkCreateOrConnectWithoutUserInput[]
    createMany?: MemoryChunkCreateManyUserInputEnvelope
    connect?: MemoryChunkWhereUniqueInput | MemoryChunkWhereUniqueInput[]
  }

  export type SummaryCreateNestedManyWithoutUserInput = {
    create?: XOR<SummaryCreateWithoutUserInput, SummaryUncheckedCreateWithoutUserInput> | SummaryCreateWithoutUserInput[] | SummaryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SummaryCreateOrConnectWithoutUserInput | SummaryCreateOrConnectWithoutUserInput[]
    createMany?: SummaryCreateManyUserInputEnvelope
    connect?: SummaryWhereUniqueInput | SummaryWhereUniqueInput[]
  }

  export type CalendarEventCreateNestedManyWithoutUserInput = {
    create?: XOR<CalendarEventCreateWithoutUserInput, CalendarEventUncheckedCreateWithoutUserInput> | CalendarEventCreateWithoutUserInput[] | CalendarEventUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CalendarEventCreateOrConnectWithoutUserInput | CalendarEventCreateOrConnectWithoutUserInput[]
    createMany?: CalendarEventCreateManyUserInputEnvelope
    connect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
  }

  export type GmailMessageCreateNestedManyWithoutUserInput = {
    create?: XOR<GmailMessageCreateWithoutUserInput, GmailMessageUncheckedCreateWithoutUserInput> | GmailMessageCreateWithoutUserInput[] | GmailMessageUncheckedCreateWithoutUserInput[]
    connectOrCreate?: GmailMessageCreateOrConnectWithoutUserInput | GmailMessageCreateOrConnectWithoutUserInput[]
    createMany?: GmailMessageCreateManyUserInputEnvelope
    connect?: GmailMessageWhereUniqueInput | GmailMessageWhereUniqueInput[]
  }

  export type DiaryEntryUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<DiaryEntryCreateWithoutUserInput, DiaryEntryUncheckedCreateWithoutUserInput> | DiaryEntryCreateWithoutUserInput[] | DiaryEntryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DiaryEntryCreateOrConnectWithoutUserInput | DiaryEntryCreateOrConnectWithoutUserInput[]
    createMany?: DiaryEntryCreateManyUserInputEnvelope
    connect?: DiaryEntryWhereUniqueInput | DiaryEntryWhereUniqueInput[]
  }

  export type MemoryChunkUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<MemoryChunkCreateWithoutUserInput, MemoryChunkUncheckedCreateWithoutUserInput> | MemoryChunkCreateWithoutUserInput[] | MemoryChunkUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MemoryChunkCreateOrConnectWithoutUserInput | MemoryChunkCreateOrConnectWithoutUserInput[]
    createMany?: MemoryChunkCreateManyUserInputEnvelope
    connect?: MemoryChunkWhereUniqueInput | MemoryChunkWhereUniqueInput[]
  }

  export type SummaryUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<SummaryCreateWithoutUserInput, SummaryUncheckedCreateWithoutUserInput> | SummaryCreateWithoutUserInput[] | SummaryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SummaryCreateOrConnectWithoutUserInput | SummaryCreateOrConnectWithoutUserInput[]
    createMany?: SummaryCreateManyUserInputEnvelope
    connect?: SummaryWhereUniqueInput | SummaryWhereUniqueInput[]
  }

  export type CalendarEventUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<CalendarEventCreateWithoutUserInput, CalendarEventUncheckedCreateWithoutUserInput> | CalendarEventCreateWithoutUserInput[] | CalendarEventUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CalendarEventCreateOrConnectWithoutUserInput | CalendarEventCreateOrConnectWithoutUserInput[]
    createMany?: CalendarEventCreateManyUserInputEnvelope
    connect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
  }

  export type GmailMessageUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<GmailMessageCreateWithoutUserInput, GmailMessageUncheckedCreateWithoutUserInput> | GmailMessageCreateWithoutUserInput[] | GmailMessageUncheckedCreateWithoutUserInput[]
    connectOrCreate?: GmailMessageCreateOrConnectWithoutUserInput | GmailMessageCreateOrConnectWithoutUserInput[]
    createMany?: GmailMessageCreateManyUserInputEnvelope
    connect?: GmailMessageWhereUniqueInput | GmailMessageWhereUniqueInput[]
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type DiaryEntryUpdateManyWithoutUserNestedInput = {
    create?: XOR<DiaryEntryCreateWithoutUserInput, DiaryEntryUncheckedCreateWithoutUserInput> | DiaryEntryCreateWithoutUserInput[] | DiaryEntryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DiaryEntryCreateOrConnectWithoutUserInput | DiaryEntryCreateOrConnectWithoutUserInput[]
    upsert?: DiaryEntryUpsertWithWhereUniqueWithoutUserInput | DiaryEntryUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: DiaryEntryCreateManyUserInputEnvelope
    set?: DiaryEntryWhereUniqueInput | DiaryEntryWhereUniqueInput[]
    disconnect?: DiaryEntryWhereUniqueInput | DiaryEntryWhereUniqueInput[]
    delete?: DiaryEntryWhereUniqueInput | DiaryEntryWhereUniqueInput[]
    connect?: DiaryEntryWhereUniqueInput | DiaryEntryWhereUniqueInput[]
    update?: DiaryEntryUpdateWithWhereUniqueWithoutUserInput | DiaryEntryUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: DiaryEntryUpdateManyWithWhereWithoutUserInput | DiaryEntryUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: DiaryEntryScalarWhereInput | DiaryEntryScalarWhereInput[]
  }

  export type MemoryChunkUpdateManyWithoutUserNestedInput = {
    create?: XOR<MemoryChunkCreateWithoutUserInput, MemoryChunkUncheckedCreateWithoutUserInput> | MemoryChunkCreateWithoutUserInput[] | MemoryChunkUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MemoryChunkCreateOrConnectWithoutUserInput | MemoryChunkCreateOrConnectWithoutUserInput[]
    upsert?: MemoryChunkUpsertWithWhereUniqueWithoutUserInput | MemoryChunkUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: MemoryChunkCreateManyUserInputEnvelope
    set?: MemoryChunkWhereUniqueInput | MemoryChunkWhereUniqueInput[]
    disconnect?: MemoryChunkWhereUniqueInput | MemoryChunkWhereUniqueInput[]
    delete?: MemoryChunkWhereUniqueInput | MemoryChunkWhereUniqueInput[]
    connect?: MemoryChunkWhereUniqueInput | MemoryChunkWhereUniqueInput[]
    update?: MemoryChunkUpdateWithWhereUniqueWithoutUserInput | MemoryChunkUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: MemoryChunkUpdateManyWithWhereWithoutUserInput | MemoryChunkUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: MemoryChunkScalarWhereInput | MemoryChunkScalarWhereInput[]
  }

  export type SummaryUpdateManyWithoutUserNestedInput = {
    create?: XOR<SummaryCreateWithoutUserInput, SummaryUncheckedCreateWithoutUserInput> | SummaryCreateWithoutUserInput[] | SummaryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SummaryCreateOrConnectWithoutUserInput | SummaryCreateOrConnectWithoutUserInput[]
    upsert?: SummaryUpsertWithWhereUniqueWithoutUserInput | SummaryUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SummaryCreateManyUserInputEnvelope
    set?: SummaryWhereUniqueInput | SummaryWhereUniqueInput[]
    disconnect?: SummaryWhereUniqueInput | SummaryWhereUniqueInput[]
    delete?: SummaryWhereUniqueInput | SummaryWhereUniqueInput[]
    connect?: SummaryWhereUniqueInput | SummaryWhereUniqueInput[]
    update?: SummaryUpdateWithWhereUniqueWithoutUserInput | SummaryUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SummaryUpdateManyWithWhereWithoutUserInput | SummaryUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SummaryScalarWhereInput | SummaryScalarWhereInput[]
  }

  export type CalendarEventUpdateManyWithoutUserNestedInput = {
    create?: XOR<CalendarEventCreateWithoutUserInput, CalendarEventUncheckedCreateWithoutUserInput> | CalendarEventCreateWithoutUserInput[] | CalendarEventUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CalendarEventCreateOrConnectWithoutUserInput | CalendarEventCreateOrConnectWithoutUserInput[]
    upsert?: CalendarEventUpsertWithWhereUniqueWithoutUserInput | CalendarEventUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: CalendarEventCreateManyUserInputEnvelope
    set?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    disconnect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    delete?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    connect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    update?: CalendarEventUpdateWithWhereUniqueWithoutUserInput | CalendarEventUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: CalendarEventUpdateManyWithWhereWithoutUserInput | CalendarEventUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: CalendarEventScalarWhereInput | CalendarEventScalarWhereInput[]
  }

  export type GmailMessageUpdateManyWithoutUserNestedInput = {
    create?: XOR<GmailMessageCreateWithoutUserInput, GmailMessageUncheckedCreateWithoutUserInput> | GmailMessageCreateWithoutUserInput[] | GmailMessageUncheckedCreateWithoutUserInput[]
    connectOrCreate?: GmailMessageCreateOrConnectWithoutUserInput | GmailMessageCreateOrConnectWithoutUserInput[]
    upsert?: GmailMessageUpsertWithWhereUniqueWithoutUserInput | GmailMessageUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: GmailMessageCreateManyUserInputEnvelope
    set?: GmailMessageWhereUniqueInput | GmailMessageWhereUniqueInput[]
    disconnect?: GmailMessageWhereUniqueInput | GmailMessageWhereUniqueInput[]
    delete?: GmailMessageWhereUniqueInput | GmailMessageWhereUniqueInput[]
    connect?: GmailMessageWhereUniqueInput | GmailMessageWhereUniqueInput[]
    update?: GmailMessageUpdateWithWhereUniqueWithoutUserInput | GmailMessageUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: GmailMessageUpdateManyWithWhereWithoutUserInput | GmailMessageUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: GmailMessageScalarWhereInput | GmailMessageScalarWhereInput[]
  }

  export type DiaryEntryUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<DiaryEntryCreateWithoutUserInput, DiaryEntryUncheckedCreateWithoutUserInput> | DiaryEntryCreateWithoutUserInput[] | DiaryEntryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DiaryEntryCreateOrConnectWithoutUserInput | DiaryEntryCreateOrConnectWithoutUserInput[]
    upsert?: DiaryEntryUpsertWithWhereUniqueWithoutUserInput | DiaryEntryUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: DiaryEntryCreateManyUserInputEnvelope
    set?: DiaryEntryWhereUniqueInput | DiaryEntryWhereUniqueInput[]
    disconnect?: DiaryEntryWhereUniqueInput | DiaryEntryWhereUniqueInput[]
    delete?: DiaryEntryWhereUniqueInput | DiaryEntryWhereUniqueInput[]
    connect?: DiaryEntryWhereUniqueInput | DiaryEntryWhereUniqueInput[]
    update?: DiaryEntryUpdateWithWhereUniqueWithoutUserInput | DiaryEntryUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: DiaryEntryUpdateManyWithWhereWithoutUserInput | DiaryEntryUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: DiaryEntryScalarWhereInput | DiaryEntryScalarWhereInput[]
  }

  export type MemoryChunkUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<MemoryChunkCreateWithoutUserInput, MemoryChunkUncheckedCreateWithoutUserInput> | MemoryChunkCreateWithoutUserInput[] | MemoryChunkUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MemoryChunkCreateOrConnectWithoutUserInput | MemoryChunkCreateOrConnectWithoutUserInput[]
    upsert?: MemoryChunkUpsertWithWhereUniqueWithoutUserInput | MemoryChunkUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: MemoryChunkCreateManyUserInputEnvelope
    set?: MemoryChunkWhereUniqueInput | MemoryChunkWhereUniqueInput[]
    disconnect?: MemoryChunkWhereUniqueInput | MemoryChunkWhereUniqueInput[]
    delete?: MemoryChunkWhereUniqueInput | MemoryChunkWhereUniqueInput[]
    connect?: MemoryChunkWhereUniqueInput | MemoryChunkWhereUniqueInput[]
    update?: MemoryChunkUpdateWithWhereUniqueWithoutUserInput | MemoryChunkUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: MemoryChunkUpdateManyWithWhereWithoutUserInput | MemoryChunkUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: MemoryChunkScalarWhereInput | MemoryChunkScalarWhereInput[]
  }

  export type SummaryUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<SummaryCreateWithoutUserInput, SummaryUncheckedCreateWithoutUserInput> | SummaryCreateWithoutUserInput[] | SummaryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SummaryCreateOrConnectWithoutUserInput | SummaryCreateOrConnectWithoutUserInput[]
    upsert?: SummaryUpsertWithWhereUniqueWithoutUserInput | SummaryUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SummaryCreateManyUserInputEnvelope
    set?: SummaryWhereUniqueInput | SummaryWhereUniqueInput[]
    disconnect?: SummaryWhereUniqueInput | SummaryWhereUniqueInput[]
    delete?: SummaryWhereUniqueInput | SummaryWhereUniqueInput[]
    connect?: SummaryWhereUniqueInput | SummaryWhereUniqueInput[]
    update?: SummaryUpdateWithWhereUniqueWithoutUserInput | SummaryUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SummaryUpdateManyWithWhereWithoutUserInput | SummaryUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SummaryScalarWhereInput | SummaryScalarWhereInput[]
  }

  export type CalendarEventUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<CalendarEventCreateWithoutUserInput, CalendarEventUncheckedCreateWithoutUserInput> | CalendarEventCreateWithoutUserInput[] | CalendarEventUncheckedCreateWithoutUserInput[]
    connectOrCreate?: CalendarEventCreateOrConnectWithoutUserInput | CalendarEventCreateOrConnectWithoutUserInput[]
    upsert?: CalendarEventUpsertWithWhereUniqueWithoutUserInput | CalendarEventUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: CalendarEventCreateManyUserInputEnvelope
    set?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    disconnect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    delete?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    connect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    update?: CalendarEventUpdateWithWhereUniqueWithoutUserInput | CalendarEventUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: CalendarEventUpdateManyWithWhereWithoutUserInput | CalendarEventUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: CalendarEventScalarWhereInput | CalendarEventScalarWhereInput[]
  }

  export type GmailMessageUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<GmailMessageCreateWithoutUserInput, GmailMessageUncheckedCreateWithoutUserInput> | GmailMessageCreateWithoutUserInput[] | GmailMessageUncheckedCreateWithoutUserInput[]
    connectOrCreate?: GmailMessageCreateOrConnectWithoutUserInput | GmailMessageCreateOrConnectWithoutUserInput[]
    upsert?: GmailMessageUpsertWithWhereUniqueWithoutUserInput | GmailMessageUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: GmailMessageCreateManyUserInputEnvelope
    set?: GmailMessageWhereUniqueInput | GmailMessageWhereUniqueInput[]
    disconnect?: GmailMessageWhereUniqueInput | GmailMessageWhereUniqueInput[]
    delete?: GmailMessageWhereUniqueInput | GmailMessageWhereUniqueInput[]
    connect?: GmailMessageWhereUniqueInput | GmailMessageWhereUniqueInput[]
    update?: GmailMessageUpdateWithWhereUniqueWithoutUserInput | GmailMessageUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: GmailMessageUpdateManyWithWhereWithoutUserInput | GmailMessageUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: GmailMessageScalarWhereInput | GmailMessageScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutDiary_entriesInput = {
    create?: XOR<UserCreateWithoutDiary_entriesInput, UserUncheckedCreateWithoutDiary_entriesInput>
    connectOrCreate?: UserCreateOrConnectWithoutDiary_entriesInput
    connect?: UserWhereUniqueInput
  }

  export type AttachmentCreateNestedManyWithoutDiary_entryInput = {
    create?: XOR<AttachmentCreateWithoutDiary_entryInput, AttachmentUncheckedCreateWithoutDiary_entryInput> | AttachmentCreateWithoutDiary_entryInput[] | AttachmentUncheckedCreateWithoutDiary_entryInput[]
    connectOrCreate?: AttachmentCreateOrConnectWithoutDiary_entryInput | AttachmentCreateOrConnectWithoutDiary_entryInput[]
    createMany?: AttachmentCreateManyDiary_entryInputEnvelope
    connect?: AttachmentWhereUniqueInput | AttachmentWhereUniqueInput[]
  }

  export type CalendarEventCreateNestedManyWithoutDiary_entryInput = {
    create?: XOR<CalendarEventCreateWithoutDiary_entryInput, CalendarEventUncheckedCreateWithoutDiary_entryInput> | CalendarEventCreateWithoutDiary_entryInput[] | CalendarEventUncheckedCreateWithoutDiary_entryInput[]
    connectOrCreate?: CalendarEventCreateOrConnectWithoutDiary_entryInput | CalendarEventCreateOrConnectWithoutDiary_entryInput[]
    createMany?: CalendarEventCreateManyDiary_entryInputEnvelope
    connect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
  }

  export type AttachmentUncheckedCreateNestedManyWithoutDiary_entryInput = {
    create?: XOR<AttachmentCreateWithoutDiary_entryInput, AttachmentUncheckedCreateWithoutDiary_entryInput> | AttachmentCreateWithoutDiary_entryInput[] | AttachmentUncheckedCreateWithoutDiary_entryInput[]
    connectOrCreate?: AttachmentCreateOrConnectWithoutDiary_entryInput | AttachmentCreateOrConnectWithoutDiary_entryInput[]
    createMany?: AttachmentCreateManyDiary_entryInputEnvelope
    connect?: AttachmentWhereUniqueInput | AttachmentWhereUniqueInput[]
  }

  export type CalendarEventUncheckedCreateNestedManyWithoutDiary_entryInput = {
    create?: XOR<CalendarEventCreateWithoutDiary_entryInput, CalendarEventUncheckedCreateWithoutDiary_entryInput> | CalendarEventCreateWithoutDiary_entryInput[] | CalendarEventUncheckedCreateWithoutDiary_entryInput[]
    connectOrCreate?: CalendarEventCreateOrConnectWithoutDiary_entryInput | CalendarEventCreateOrConnectWithoutDiary_entryInput[]
    createMany?: CalendarEventCreateManyDiary_entryInputEnvelope
    connect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
  }

  export type UserUpdateOneRequiredWithoutDiary_entriesNestedInput = {
    create?: XOR<UserCreateWithoutDiary_entriesInput, UserUncheckedCreateWithoutDiary_entriesInput>
    connectOrCreate?: UserCreateOrConnectWithoutDiary_entriesInput
    upsert?: UserUpsertWithoutDiary_entriesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutDiary_entriesInput, UserUpdateWithoutDiary_entriesInput>, UserUncheckedUpdateWithoutDiary_entriesInput>
  }

  export type AttachmentUpdateManyWithoutDiary_entryNestedInput = {
    create?: XOR<AttachmentCreateWithoutDiary_entryInput, AttachmentUncheckedCreateWithoutDiary_entryInput> | AttachmentCreateWithoutDiary_entryInput[] | AttachmentUncheckedCreateWithoutDiary_entryInput[]
    connectOrCreate?: AttachmentCreateOrConnectWithoutDiary_entryInput | AttachmentCreateOrConnectWithoutDiary_entryInput[]
    upsert?: AttachmentUpsertWithWhereUniqueWithoutDiary_entryInput | AttachmentUpsertWithWhereUniqueWithoutDiary_entryInput[]
    createMany?: AttachmentCreateManyDiary_entryInputEnvelope
    set?: AttachmentWhereUniqueInput | AttachmentWhereUniqueInput[]
    disconnect?: AttachmentWhereUniqueInput | AttachmentWhereUniqueInput[]
    delete?: AttachmentWhereUniqueInput | AttachmentWhereUniqueInput[]
    connect?: AttachmentWhereUniqueInput | AttachmentWhereUniqueInput[]
    update?: AttachmentUpdateWithWhereUniqueWithoutDiary_entryInput | AttachmentUpdateWithWhereUniqueWithoutDiary_entryInput[]
    updateMany?: AttachmentUpdateManyWithWhereWithoutDiary_entryInput | AttachmentUpdateManyWithWhereWithoutDiary_entryInput[]
    deleteMany?: AttachmentScalarWhereInput | AttachmentScalarWhereInput[]
  }

  export type CalendarEventUpdateManyWithoutDiary_entryNestedInput = {
    create?: XOR<CalendarEventCreateWithoutDiary_entryInput, CalendarEventUncheckedCreateWithoutDiary_entryInput> | CalendarEventCreateWithoutDiary_entryInput[] | CalendarEventUncheckedCreateWithoutDiary_entryInput[]
    connectOrCreate?: CalendarEventCreateOrConnectWithoutDiary_entryInput | CalendarEventCreateOrConnectWithoutDiary_entryInput[]
    upsert?: CalendarEventUpsertWithWhereUniqueWithoutDiary_entryInput | CalendarEventUpsertWithWhereUniqueWithoutDiary_entryInput[]
    createMany?: CalendarEventCreateManyDiary_entryInputEnvelope
    set?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    disconnect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    delete?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    connect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    update?: CalendarEventUpdateWithWhereUniqueWithoutDiary_entryInput | CalendarEventUpdateWithWhereUniqueWithoutDiary_entryInput[]
    updateMany?: CalendarEventUpdateManyWithWhereWithoutDiary_entryInput | CalendarEventUpdateManyWithWhereWithoutDiary_entryInput[]
    deleteMany?: CalendarEventScalarWhereInput | CalendarEventScalarWhereInput[]
  }

  export type AttachmentUncheckedUpdateManyWithoutDiary_entryNestedInput = {
    create?: XOR<AttachmentCreateWithoutDiary_entryInput, AttachmentUncheckedCreateWithoutDiary_entryInput> | AttachmentCreateWithoutDiary_entryInput[] | AttachmentUncheckedCreateWithoutDiary_entryInput[]
    connectOrCreate?: AttachmentCreateOrConnectWithoutDiary_entryInput | AttachmentCreateOrConnectWithoutDiary_entryInput[]
    upsert?: AttachmentUpsertWithWhereUniqueWithoutDiary_entryInput | AttachmentUpsertWithWhereUniqueWithoutDiary_entryInput[]
    createMany?: AttachmentCreateManyDiary_entryInputEnvelope
    set?: AttachmentWhereUniqueInput | AttachmentWhereUniqueInput[]
    disconnect?: AttachmentWhereUniqueInput | AttachmentWhereUniqueInput[]
    delete?: AttachmentWhereUniqueInput | AttachmentWhereUniqueInput[]
    connect?: AttachmentWhereUniqueInput | AttachmentWhereUniqueInput[]
    update?: AttachmentUpdateWithWhereUniqueWithoutDiary_entryInput | AttachmentUpdateWithWhereUniqueWithoutDiary_entryInput[]
    updateMany?: AttachmentUpdateManyWithWhereWithoutDiary_entryInput | AttachmentUpdateManyWithWhereWithoutDiary_entryInput[]
    deleteMany?: AttachmentScalarWhereInput | AttachmentScalarWhereInput[]
  }

  export type CalendarEventUncheckedUpdateManyWithoutDiary_entryNestedInput = {
    create?: XOR<CalendarEventCreateWithoutDiary_entryInput, CalendarEventUncheckedCreateWithoutDiary_entryInput> | CalendarEventCreateWithoutDiary_entryInput[] | CalendarEventUncheckedCreateWithoutDiary_entryInput[]
    connectOrCreate?: CalendarEventCreateOrConnectWithoutDiary_entryInput | CalendarEventCreateOrConnectWithoutDiary_entryInput[]
    upsert?: CalendarEventUpsertWithWhereUniqueWithoutDiary_entryInput | CalendarEventUpsertWithWhereUniqueWithoutDiary_entryInput[]
    createMany?: CalendarEventCreateManyDiary_entryInputEnvelope
    set?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    disconnect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    delete?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    connect?: CalendarEventWhereUniqueInput | CalendarEventWhereUniqueInput[]
    update?: CalendarEventUpdateWithWhereUniqueWithoutDiary_entryInput | CalendarEventUpdateWithWhereUniqueWithoutDiary_entryInput[]
    updateMany?: CalendarEventUpdateManyWithWhereWithoutDiary_entryInput | CalendarEventUpdateManyWithWhereWithoutDiary_entryInput[]
    deleteMany?: CalendarEventScalarWhereInput | CalendarEventScalarWhereInput[]
  }

  export type DiaryEntryCreateNestedOneWithoutAttachmentsInput = {
    create?: XOR<DiaryEntryCreateWithoutAttachmentsInput, DiaryEntryUncheckedCreateWithoutAttachmentsInput>
    connectOrCreate?: DiaryEntryCreateOrConnectWithoutAttachmentsInput
    connect?: DiaryEntryWhereUniqueInput
  }

  export type DiaryEntryUpdateOneRequiredWithoutAttachmentsNestedInput = {
    create?: XOR<DiaryEntryCreateWithoutAttachmentsInput, DiaryEntryUncheckedCreateWithoutAttachmentsInput>
    connectOrCreate?: DiaryEntryCreateOrConnectWithoutAttachmentsInput
    upsert?: DiaryEntryUpsertWithoutAttachmentsInput
    connect?: DiaryEntryWhereUniqueInput
    update?: XOR<XOR<DiaryEntryUpdateToOneWithWhereWithoutAttachmentsInput, DiaryEntryUpdateWithoutAttachmentsInput>, DiaryEntryUncheckedUpdateWithoutAttachmentsInput>
  }

  export type UserCreateNestedOneWithoutMemory_chunksInput = {
    create?: XOR<UserCreateWithoutMemory_chunksInput, UserUncheckedCreateWithoutMemory_chunksInput>
    connectOrCreate?: UserCreateOrConnectWithoutMemory_chunksInput
    connect?: UserWhereUniqueInput
  }

  export type EntityMentionCreateNestedManyWithoutChunkInput = {
    create?: XOR<EntityMentionCreateWithoutChunkInput, EntityMentionUncheckedCreateWithoutChunkInput> | EntityMentionCreateWithoutChunkInput[] | EntityMentionUncheckedCreateWithoutChunkInput[]
    connectOrCreate?: EntityMentionCreateOrConnectWithoutChunkInput | EntityMentionCreateOrConnectWithoutChunkInput[]
    createMany?: EntityMentionCreateManyChunkInputEnvelope
    connect?: EntityMentionWhereUniqueInput | EntityMentionWhereUniqueInput[]
  }

  export type EntityMentionUncheckedCreateNestedManyWithoutChunkInput = {
    create?: XOR<EntityMentionCreateWithoutChunkInput, EntityMentionUncheckedCreateWithoutChunkInput> | EntityMentionCreateWithoutChunkInput[] | EntityMentionUncheckedCreateWithoutChunkInput[]
    connectOrCreate?: EntityMentionCreateOrConnectWithoutChunkInput | EntityMentionCreateOrConnectWithoutChunkInput[]
    createMany?: EntityMentionCreateManyChunkInputEnvelope
    connect?: EntityMentionWhereUniqueInput | EntityMentionWhereUniqueInput[]
  }

  export type UserUpdateOneRequiredWithoutMemory_chunksNestedInput = {
    create?: XOR<UserCreateWithoutMemory_chunksInput, UserUncheckedCreateWithoutMemory_chunksInput>
    connectOrCreate?: UserCreateOrConnectWithoutMemory_chunksInput
    upsert?: UserUpsertWithoutMemory_chunksInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutMemory_chunksInput, UserUpdateWithoutMemory_chunksInput>, UserUncheckedUpdateWithoutMemory_chunksInput>
  }

  export type EntityMentionUpdateManyWithoutChunkNestedInput = {
    create?: XOR<EntityMentionCreateWithoutChunkInput, EntityMentionUncheckedCreateWithoutChunkInput> | EntityMentionCreateWithoutChunkInput[] | EntityMentionUncheckedCreateWithoutChunkInput[]
    connectOrCreate?: EntityMentionCreateOrConnectWithoutChunkInput | EntityMentionCreateOrConnectWithoutChunkInput[]
    upsert?: EntityMentionUpsertWithWhereUniqueWithoutChunkInput | EntityMentionUpsertWithWhereUniqueWithoutChunkInput[]
    createMany?: EntityMentionCreateManyChunkInputEnvelope
    set?: EntityMentionWhereUniqueInput | EntityMentionWhereUniqueInput[]
    disconnect?: EntityMentionWhereUniqueInput | EntityMentionWhereUniqueInput[]
    delete?: EntityMentionWhereUniqueInput | EntityMentionWhereUniqueInput[]
    connect?: EntityMentionWhereUniqueInput | EntityMentionWhereUniqueInput[]
    update?: EntityMentionUpdateWithWhereUniqueWithoutChunkInput | EntityMentionUpdateWithWhereUniqueWithoutChunkInput[]
    updateMany?: EntityMentionUpdateManyWithWhereWithoutChunkInput | EntityMentionUpdateManyWithWhereWithoutChunkInput[]
    deleteMany?: EntityMentionScalarWhereInput | EntityMentionScalarWhereInput[]
  }

  export type EntityMentionUncheckedUpdateManyWithoutChunkNestedInput = {
    create?: XOR<EntityMentionCreateWithoutChunkInput, EntityMentionUncheckedCreateWithoutChunkInput> | EntityMentionCreateWithoutChunkInput[] | EntityMentionUncheckedCreateWithoutChunkInput[]
    connectOrCreate?: EntityMentionCreateOrConnectWithoutChunkInput | EntityMentionCreateOrConnectWithoutChunkInput[]
    upsert?: EntityMentionUpsertWithWhereUniqueWithoutChunkInput | EntityMentionUpsertWithWhereUniqueWithoutChunkInput[]
    createMany?: EntityMentionCreateManyChunkInputEnvelope
    set?: EntityMentionWhereUniqueInput | EntityMentionWhereUniqueInput[]
    disconnect?: EntityMentionWhereUniqueInput | EntityMentionWhereUniqueInput[]
    delete?: EntityMentionWhereUniqueInput | EntityMentionWhereUniqueInput[]
    connect?: EntityMentionWhereUniqueInput | EntityMentionWhereUniqueInput[]
    update?: EntityMentionUpdateWithWhereUniqueWithoutChunkInput | EntityMentionUpdateWithWhereUniqueWithoutChunkInput[]
    updateMany?: EntityMentionUpdateManyWithWhereWithoutChunkInput | EntityMentionUpdateManyWithWhereWithoutChunkInput[]
    deleteMany?: EntityMentionScalarWhereInput | EntityMentionScalarWhereInput[]
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedUuidFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedUuidFilter<$PrismaModel> | string
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedUuidWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedUuidWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type UserCreateWithoutCalendar_eventsInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    diary_entries?: DiaryEntryCreateNestedManyWithoutUserInput
    memory_chunks?: MemoryChunkCreateNestedManyWithoutUserInput
    summaries?: SummaryCreateNestedManyWithoutUserInput
    gmail_messages?: GmailMessageCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutCalendar_eventsInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    diary_entries?: DiaryEntryUncheckedCreateNestedManyWithoutUserInput
    memory_chunks?: MemoryChunkUncheckedCreateNestedManyWithoutUserInput
    summaries?: SummaryUncheckedCreateNestedManyWithoutUserInput
    gmail_messages?: GmailMessageUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutCalendar_eventsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutCalendar_eventsInput, UserUncheckedCreateWithoutCalendar_eventsInput>
  }

  export type DiaryEntryCreateWithoutCalendar_eventsInput = {
    id?: string
    entry_date?: Date | string
    raw_text: string
    status?: string
    created_at?: Date | string
    updated_at?: Date | string
    user: UserCreateNestedOneWithoutDiary_entriesInput
    attachments?: AttachmentCreateNestedManyWithoutDiary_entryInput
  }

  export type DiaryEntryUncheckedCreateWithoutCalendar_eventsInput = {
    id?: string
    user_id: string
    entry_date?: Date | string
    raw_text: string
    status?: string
    created_at?: Date | string
    updated_at?: Date | string
    attachments?: AttachmentUncheckedCreateNestedManyWithoutDiary_entryInput
  }

  export type DiaryEntryCreateOrConnectWithoutCalendar_eventsInput = {
    where: DiaryEntryWhereUniqueInput
    create: XOR<DiaryEntryCreateWithoutCalendar_eventsInput, DiaryEntryUncheckedCreateWithoutCalendar_eventsInput>
  }

  export type UserUpsertWithoutCalendar_eventsInput = {
    update: XOR<UserUpdateWithoutCalendar_eventsInput, UserUncheckedUpdateWithoutCalendar_eventsInput>
    create: XOR<UserCreateWithoutCalendar_eventsInput, UserUncheckedCreateWithoutCalendar_eventsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutCalendar_eventsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutCalendar_eventsInput, UserUncheckedUpdateWithoutCalendar_eventsInput>
  }

  export type UserUpdateWithoutCalendar_eventsInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entries?: DiaryEntryUpdateManyWithoutUserNestedInput
    memory_chunks?: MemoryChunkUpdateManyWithoutUserNestedInput
    summaries?: SummaryUpdateManyWithoutUserNestedInput
    gmail_messages?: GmailMessageUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutCalendar_eventsInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entries?: DiaryEntryUncheckedUpdateManyWithoutUserNestedInput
    memory_chunks?: MemoryChunkUncheckedUpdateManyWithoutUserNestedInput
    summaries?: SummaryUncheckedUpdateManyWithoutUserNestedInput
    gmail_messages?: GmailMessageUncheckedUpdateManyWithoutUserNestedInput
  }

  export type DiaryEntryUpsertWithoutCalendar_eventsInput = {
    update: XOR<DiaryEntryUpdateWithoutCalendar_eventsInput, DiaryEntryUncheckedUpdateWithoutCalendar_eventsInput>
    create: XOR<DiaryEntryCreateWithoutCalendar_eventsInput, DiaryEntryUncheckedCreateWithoutCalendar_eventsInput>
    where?: DiaryEntryWhereInput
  }

  export type DiaryEntryUpdateToOneWithWhereWithoutCalendar_eventsInput = {
    where?: DiaryEntryWhereInput
    data: XOR<DiaryEntryUpdateWithoutCalendar_eventsInput, DiaryEntryUncheckedUpdateWithoutCalendar_eventsInput>
  }

  export type DiaryEntryUpdateWithoutCalendar_eventsInput = {
    id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutDiary_entriesNestedInput
    attachments?: AttachmentUpdateManyWithoutDiary_entryNestedInput
  }

  export type DiaryEntryUncheckedUpdateWithoutCalendar_eventsInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    attachments?: AttachmentUncheckedUpdateManyWithoutDiary_entryNestedInput
  }

  export type UserCreateWithoutSummariesInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    diary_entries?: DiaryEntryCreateNestedManyWithoutUserInput
    memory_chunks?: MemoryChunkCreateNestedManyWithoutUserInput
    calendar_events?: CalendarEventCreateNestedManyWithoutUserInput
    gmail_messages?: GmailMessageCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutSummariesInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    diary_entries?: DiaryEntryUncheckedCreateNestedManyWithoutUserInput
    memory_chunks?: MemoryChunkUncheckedCreateNestedManyWithoutUserInput
    calendar_events?: CalendarEventUncheckedCreateNestedManyWithoutUserInput
    gmail_messages?: GmailMessageUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutSummariesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSummariesInput, UserUncheckedCreateWithoutSummariesInput>
  }

  export type UserUpsertWithoutSummariesInput = {
    update: XOR<UserUpdateWithoutSummariesInput, UserUncheckedUpdateWithoutSummariesInput>
    create: XOR<UserCreateWithoutSummariesInput, UserUncheckedCreateWithoutSummariesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSummariesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSummariesInput, UserUncheckedUpdateWithoutSummariesInput>
  }

  export type UserUpdateWithoutSummariesInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entries?: DiaryEntryUpdateManyWithoutUserNestedInput
    memory_chunks?: MemoryChunkUpdateManyWithoutUserNestedInput
    calendar_events?: CalendarEventUpdateManyWithoutUserNestedInput
    gmail_messages?: GmailMessageUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSummariesInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entries?: DiaryEntryUncheckedUpdateManyWithoutUserNestedInput
    memory_chunks?: MemoryChunkUncheckedUpdateManyWithoutUserNestedInput
    calendar_events?: CalendarEventUncheckedUpdateManyWithoutUserNestedInput
    gmail_messages?: GmailMessageUncheckedUpdateManyWithoutUserNestedInput
  }

  export type MemoryChunkCreateWithoutEntity_mentionsInput = {
    id?: string
    sourceType: string
    sourceId: string
    chunkType?: string
    text: string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutMemory_chunksInput
  }

  export type MemoryChunkUncheckedCreateWithoutEntity_mentionsInput = {
    id?: string
    userId: string
    sourceType: string
    sourceId: string
    chunkType?: string
    text: string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MemoryChunkCreateOrConnectWithoutEntity_mentionsInput = {
    where: MemoryChunkWhereUniqueInput
    create: XOR<MemoryChunkCreateWithoutEntity_mentionsInput, MemoryChunkUncheckedCreateWithoutEntity_mentionsInput>
  }

  export type MemoryChunkUpsertWithoutEntity_mentionsInput = {
    update: XOR<MemoryChunkUpdateWithoutEntity_mentionsInput, MemoryChunkUncheckedUpdateWithoutEntity_mentionsInput>
    create: XOR<MemoryChunkCreateWithoutEntity_mentionsInput, MemoryChunkUncheckedCreateWithoutEntity_mentionsInput>
    where?: MemoryChunkWhereInput
  }

  export type MemoryChunkUpdateToOneWithWhereWithoutEntity_mentionsInput = {
    where?: MemoryChunkWhereInput
    data: XOR<MemoryChunkUpdateWithoutEntity_mentionsInput, MemoryChunkUncheckedUpdateWithoutEntity_mentionsInput>
  }

  export type MemoryChunkUpdateWithoutEntity_mentionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    chunkType?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutMemory_chunksNestedInput
  }

  export type MemoryChunkUncheckedUpdateWithoutEntity_mentionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    chunkType?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateWithoutGmail_messagesInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    diary_entries?: DiaryEntryCreateNestedManyWithoutUserInput
    memory_chunks?: MemoryChunkCreateNestedManyWithoutUserInput
    summaries?: SummaryCreateNestedManyWithoutUserInput
    calendar_events?: CalendarEventCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutGmail_messagesInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    diary_entries?: DiaryEntryUncheckedCreateNestedManyWithoutUserInput
    memory_chunks?: MemoryChunkUncheckedCreateNestedManyWithoutUserInput
    summaries?: SummaryUncheckedCreateNestedManyWithoutUserInput
    calendar_events?: CalendarEventUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutGmail_messagesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutGmail_messagesInput, UserUncheckedCreateWithoutGmail_messagesInput>
  }

  export type UserUpsertWithoutGmail_messagesInput = {
    update: XOR<UserUpdateWithoutGmail_messagesInput, UserUncheckedUpdateWithoutGmail_messagesInput>
    create: XOR<UserCreateWithoutGmail_messagesInput, UserUncheckedCreateWithoutGmail_messagesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutGmail_messagesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutGmail_messagesInput, UserUncheckedUpdateWithoutGmail_messagesInput>
  }

  export type UserUpdateWithoutGmail_messagesInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entries?: DiaryEntryUpdateManyWithoutUserNestedInput
    memory_chunks?: MemoryChunkUpdateManyWithoutUserNestedInput
    summaries?: SummaryUpdateManyWithoutUserNestedInput
    calendar_events?: CalendarEventUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutGmail_messagesInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entries?: DiaryEntryUncheckedUpdateManyWithoutUserNestedInput
    memory_chunks?: MemoryChunkUncheckedUpdateManyWithoutUserNestedInput
    summaries?: SummaryUncheckedUpdateManyWithoutUserNestedInput
    calendar_events?: CalendarEventUncheckedUpdateManyWithoutUserNestedInput
  }

  export type DiaryEntryCreateWithoutUserInput = {
    id?: string
    entry_date?: Date | string
    raw_text: string
    status?: string
    created_at?: Date | string
    updated_at?: Date | string
    attachments?: AttachmentCreateNestedManyWithoutDiary_entryInput
    calendar_events?: CalendarEventCreateNestedManyWithoutDiary_entryInput
  }

  export type DiaryEntryUncheckedCreateWithoutUserInput = {
    id?: string
    entry_date?: Date | string
    raw_text: string
    status?: string
    created_at?: Date | string
    updated_at?: Date | string
    attachments?: AttachmentUncheckedCreateNestedManyWithoutDiary_entryInput
    calendar_events?: CalendarEventUncheckedCreateNestedManyWithoutDiary_entryInput
  }

  export type DiaryEntryCreateOrConnectWithoutUserInput = {
    where: DiaryEntryWhereUniqueInput
    create: XOR<DiaryEntryCreateWithoutUserInput, DiaryEntryUncheckedCreateWithoutUserInput>
  }

  export type DiaryEntryCreateManyUserInputEnvelope = {
    data: DiaryEntryCreateManyUserInput | DiaryEntryCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type MemoryChunkCreateWithoutUserInput = {
    id?: string
    sourceType: string
    sourceId: string
    chunkType?: string
    text: string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    entity_mentions?: EntityMentionCreateNestedManyWithoutChunkInput
  }

  export type MemoryChunkUncheckedCreateWithoutUserInput = {
    id?: string
    sourceType: string
    sourceId: string
    chunkType?: string
    text: string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    entity_mentions?: EntityMentionUncheckedCreateNestedManyWithoutChunkInput
  }

  export type MemoryChunkCreateOrConnectWithoutUserInput = {
    where: MemoryChunkWhereUniqueInput
    create: XOR<MemoryChunkCreateWithoutUserInput, MemoryChunkUncheckedCreateWithoutUserInput>
  }

  export type MemoryChunkCreateManyUserInputEnvelope = {
    data: MemoryChunkCreateManyUserInput | MemoryChunkCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type SummaryCreateWithoutUserInput = {
    id?: string
    summary_type: string
    period_start: Date | string
    period_end: Date | string
    content: string
    created_at?: Date | string
  }

  export type SummaryUncheckedCreateWithoutUserInput = {
    id?: string
    summary_type: string
    period_start: Date | string
    period_end: Date | string
    content: string
    created_at?: Date | string
  }

  export type SummaryCreateOrConnectWithoutUserInput = {
    where: SummaryWhereUniqueInput
    create: XOR<SummaryCreateWithoutUserInput, SummaryUncheckedCreateWithoutUserInput>
  }

  export type SummaryCreateManyUserInputEnvelope = {
    data: SummaryCreateManyUserInput | SummaryCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type CalendarEventCreateWithoutUserInput = {
    id?: string
    external_id: string
    title: string
    start_time: Date | string
    end_time: Date | string
    created_at?: Date | string
    updated_at?: Date | string
    diary_entry?: DiaryEntryCreateNestedOneWithoutCalendar_eventsInput
  }

  export type CalendarEventUncheckedCreateWithoutUserInput = {
    id?: string
    external_id: string
    title: string
    start_time: Date | string
    end_time: Date | string
    diary_entry_id?: string | null
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type CalendarEventCreateOrConnectWithoutUserInput = {
    where: CalendarEventWhereUniqueInput
    create: XOR<CalendarEventCreateWithoutUserInput, CalendarEventUncheckedCreateWithoutUserInput>
  }

  export type CalendarEventCreateManyUserInputEnvelope = {
    data: CalendarEventCreateManyUserInput | CalendarEventCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type GmailMessageCreateWithoutUserInput = {
    id?: string
    external_id: string
    sender: string
    subject: string
    body: string
    created_at?: Date | string
  }

  export type GmailMessageUncheckedCreateWithoutUserInput = {
    id?: string
    external_id: string
    sender: string
    subject: string
    body: string
    created_at?: Date | string
  }

  export type GmailMessageCreateOrConnectWithoutUserInput = {
    where: GmailMessageWhereUniqueInput
    create: XOR<GmailMessageCreateWithoutUserInput, GmailMessageUncheckedCreateWithoutUserInput>
  }

  export type GmailMessageCreateManyUserInputEnvelope = {
    data: GmailMessageCreateManyUserInput | GmailMessageCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type DiaryEntryUpsertWithWhereUniqueWithoutUserInput = {
    where: DiaryEntryWhereUniqueInput
    update: XOR<DiaryEntryUpdateWithoutUserInput, DiaryEntryUncheckedUpdateWithoutUserInput>
    create: XOR<DiaryEntryCreateWithoutUserInput, DiaryEntryUncheckedCreateWithoutUserInput>
  }

  export type DiaryEntryUpdateWithWhereUniqueWithoutUserInput = {
    where: DiaryEntryWhereUniqueInput
    data: XOR<DiaryEntryUpdateWithoutUserInput, DiaryEntryUncheckedUpdateWithoutUserInput>
  }

  export type DiaryEntryUpdateManyWithWhereWithoutUserInput = {
    where: DiaryEntryScalarWhereInput
    data: XOR<DiaryEntryUpdateManyMutationInput, DiaryEntryUncheckedUpdateManyWithoutUserInput>
  }

  export type DiaryEntryScalarWhereInput = {
    AND?: DiaryEntryScalarWhereInput | DiaryEntryScalarWhereInput[]
    OR?: DiaryEntryScalarWhereInput[]
    NOT?: DiaryEntryScalarWhereInput | DiaryEntryScalarWhereInput[]
    id?: StringFilter<"DiaryEntry"> | string
    user_id?: StringFilter<"DiaryEntry"> | string
    entry_date?: DateTimeFilter<"DiaryEntry"> | Date | string
    raw_text?: StringFilter<"DiaryEntry"> | string
    status?: StringFilter<"DiaryEntry"> | string
    created_at?: DateTimeFilter<"DiaryEntry"> | Date | string
    updated_at?: DateTimeFilter<"DiaryEntry"> | Date | string
  }

  export type MemoryChunkUpsertWithWhereUniqueWithoutUserInput = {
    where: MemoryChunkWhereUniqueInput
    update: XOR<MemoryChunkUpdateWithoutUserInput, MemoryChunkUncheckedUpdateWithoutUserInput>
    create: XOR<MemoryChunkCreateWithoutUserInput, MemoryChunkUncheckedCreateWithoutUserInput>
  }

  export type MemoryChunkUpdateWithWhereUniqueWithoutUserInput = {
    where: MemoryChunkWhereUniqueInput
    data: XOR<MemoryChunkUpdateWithoutUserInput, MemoryChunkUncheckedUpdateWithoutUserInput>
  }

  export type MemoryChunkUpdateManyWithWhereWithoutUserInput = {
    where: MemoryChunkScalarWhereInput
    data: XOR<MemoryChunkUpdateManyMutationInput, MemoryChunkUncheckedUpdateManyWithoutUserInput>
  }

  export type MemoryChunkScalarWhereInput = {
    AND?: MemoryChunkScalarWhereInput | MemoryChunkScalarWhereInput[]
    OR?: MemoryChunkScalarWhereInput[]
    NOT?: MemoryChunkScalarWhereInput | MemoryChunkScalarWhereInput[]
    id?: StringFilter<"MemoryChunk"> | string
    userId?: StringFilter<"MemoryChunk"> | string
    sourceType?: StringFilter<"MemoryChunk"> | string
    sourceId?: StringFilter<"MemoryChunk"> | string
    chunkType?: StringFilter<"MemoryChunk"> | string
    text?: StringFilter<"MemoryChunk"> | string
    metadata?: JsonNullableFilter<"MemoryChunk">
    createdAt?: DateTimeFilter<"MemoryChunk"> | Date | string
    updatedAt?: DateTimeFilter<"MemoryChunk"> | Date | string
  }

  export type SummaryUpsertWithWhereUniqueWithoutUserInput = {
    where: SummaryWhereUniqueInput
    update: XOR<SummaryUpdateWithoutUserInput, SummaryUncheckedUpdateWithoutUserInput>
    create: XOR<SummaryCreateWithoutUserInput, SummaryUncheckedCreateWithoutUserInput>
  }

  export type SummaryUpdateWithWhereUniqueWithoutUserInput = {
    where: SummaryWhereUniqueInput
    data: XOR<SummaryUpdateWithoutUserInput, SummaryUncheckedUpdateWithoutUserInput>
  }

  export type SummaryUpdateManyWithWhereWithoutUserInput = {
    where: SummaryScalarWhereInput
    data: XOR<SummaryUpdateManyMutationInput, SummaryUncheckedUpdateManyWithoutUserInput>
  }

  export type SummaryScalarWhereInput = {
    AND?: SummaryScalarWhereInput | SummaryScalarWhereInput[]
    OR?: SummaryScalarWhereInput[]
    NOT?: SummaryScalarWhereInput | SummaryScalarWhereInput[]
    id?: StringFilter<"Summary"> | string
    user_id?: StringFilter<"Summary"> | string
    summary_type?: StringFilter<"Summary"> | string
    period_start?: DateTimeFilter<"Summary"> | Date | string
    period_end?: DateTimeFilter<"Summary"> | Date | string
    content?: StringFilter<"Summary"> | string
    created_at?: DateTimeFilter<"Summary"> | Date | string
  }

  export type CalendarEventUpsertWithWhereUniqueWithoutUserInput = {
    where: CalendarEventWhereUniqueInput
    update: XOR<CalendarEventUpdateWithoutUserInput, CalendarEventUncheckedUpdateWithoutUserInput>
    create: XOR<CalendarEventCreateWithoutUserInput, CalendarEventUncheckedCreateWithoutUserInput>
  }

  export type CalendarEventUpdateWithWhereUniqueWithoutUserInput = {
    where: CalendarEventWhereUniqueInput
    data: XOR<CalendarEventUpdateWithoutUserInput, CalendarEventUncheckedUpdateWithoutUserInput>
  }

  export type CalendarEventUpdateManyWithWhereWithoutUserInput = {
    where: CalendarEventScalarWhereInput
    data: XOR<CalendarEventUpdateManyMutationInput, CalendarEventUncheckedUpdateManyWithoutUserInput>
  }

  export type CalendarEventScalarWhereInput = {
    AND?: CalendarEventScalarWhereInput | CalendarEventScalarWhereInput[]
    OR?: CalendarEventScalarWhereInput[]
    NOT?: CalendarEventScalarWhereInput | CalendarEventScalarWhereInput[]
    id?: StringFilter<"CalendarEvent"> | string
    user_id?: StringFilter<"CalendarEvent"> | string
    external_id?: StringFilter<"CalendarEvent"> | string
    title?: StringFilter<"CalendarEvent"> | string
    start_time?: DateTimeFilter<"CalendarEvent"> | Date | string
    end_time?: DateTimeFilter<"CalendarEvent"> | Date | string
    diary_entry_id?: StringNullableFilter<"CalendarEvent"> | string | null
    created_at?: DateTimeFilter<"CalendarEvent"> | Date | string
    updated_at?: DateTimeFilter<"CalendarEvent"> | Date | string
  }

  export type GmailMessageUpsertWithWhereUniqueWithoutUserInput = {
    where: GmailMessageWhereUniqueInput
    update: XOR<GmailMessageUpdateWithoutUserInput, GmailMessageUncheckedUpdateWithoutUserInput>
    create: XOR<GmailMessageCreateWithoutUserInput, GmailMessageUncheckedCreateWithoutUserInput>
  }

  export type GmailMessageUpdateWithWhereUniqueWithoutUserInput = {
    where: GmailMessageWhereUniqueInput
    data: XOR<GmailMessageUpdateWithoutUserInput, GmailMessageUncheckedUpdateWithoutUserInput>
  }

  export type GmailMessageUpdateManyWithWhereWithoutUserInput = {
    where: GmailMessageScalarWhereInput
    data: XOR<GmailMessageUpdateManyMutationInput, GmailMessageUncheckedUpdateManyWithoutUserInput>
  }

  export type GmailMessageScalarWhereInput = {
    AND?: GmailMessageScalarWhereInput | GmailMessageScalarWhereInput[]
    OR?: GmailMessageScalarWhereInput[]
    NOT?: GmailMessageScalarWhereInput | GmailMessageScalarWhereInput[]
    id?: StringFilter<"GmailMessage"> | string
    user_id?: StringFilter<"GmailMessage"> | string
    external_id?: StringFilter<"GmailMessage"> | string
    sender?: StringFilter<"GmailMessage"> | string
    subject?: StringFilter<"GmailMessage"> | string
    body?: StringFilter<"GmailMessage"> | string
    created_at?: DateTimeFilter<"GmailMessage"> | Date | string
  }

  export type UserCreateWithoutDiary_entriesInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    memory_chunks?: MemoryChunkCreateNestedManyWithoutUserInput
    summaries?: SummaryCreateNestedManyWithoutUserInput
    calendar_events?: CalendarEventCreateNestedManyWithoutUserInput
    gmail_messages?: GmailMessageCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutDiary_entriesInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    memory_chunks?: MemoryChunkUncheckedCreateNestedManyWithoutUserInput
    summaries?: SummaryUncheckedCreateNestedManyWithoutUserInput
    calendar_events?: CalendarEventUncheckedCreateNestedManyWithoutUserInput
    gmail_messages?: GmailMessageUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutDiary_entriesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutDiary_entriesInput, UserUncheckedCreateWithoutDiary_entriesInput>
  }

  export type AttachmentCreateWithoutDiary_entryInput = {
    id?: string
    storage_path: string
    file_type: string
    extracted_text?: string | null
    created_at?: Date | string
  }

  export type AttachmentUncheckedCreateWithoutDiary_entryInput = {
    id?: string
    storage_path: string
    file_type: string
    extracted_text?: string | null
    created_at?: Date | string
  }

  export type AttachmentCreateOrConnectWithoutDiary_entryInput = {
    where: AttachmentWhereUniqueInput
    create: XOR<AttachmentCreateWithoutDiary_entryInput, AttachmentUncheckedCreateWithoutDiary_entryInput>
  }

  export type AttachmentCreateManyDiary_entryInputEnvelope = {
    data: AttachmentCreateManyDiary_entryInput | AttachmentCreateManyDiary_entryInput[]
    skipDuplicates?: boolean
  }

  export type CalendarEventCreateWithoutDiary_entryInput = {
    id?: string
    external_id: string
    title: string
    start_time: Date | string
    end_time: Date | string
    created_at?: Date | string
    updated_at?: Date | string
    user: UserCreateNestedOneWithoutCalendar_eventsInput
  }

  export type CalendarEventUncheckedCreateWithoutDiary_entryInput = {
    id?: string
    user_id: string
    external_id: string
    title: string
    start_time: Date | string
    end_time: Date | string
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type CalendarEventCreateOrConnectWithoutDiary_entryInput = {
    where: CalendarEventWhereUniqueInput
    create: XOR<CalendarEventCreateWithoutDiary_entryInput, CalendarEventUncheckedCreateWithoutDiary_entryInput>
  }

  export type CalendarEventCreateManyDiary_entryInputEnvelope = {
    data: CalendarEventCreateManyDiary_entryInput | CalendarEventCreateManyDiary_entryInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutDiary_entriesInput = {
    update: XOR<UserUpdateWithoutDiary_entriesInput, UserUncheckedUpdateWithoutDiary_entriesInput>
    create: XOR<UserCreateWithoutDiary_entriesInput, UserUncheckedCreateWithoutDiary_entriesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutDiary_entriesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutDiary_entriesInput, UserUncheckedUpdateWithoutDiary_entriesInput>
  }

  export type UserUpdateWithoutDiary_entriesInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    memory_chunks?: MemoryChunkUpdateManyWithoutUserNestedInput
    summaries?: SummaryUpdateManyWithoutUserNestedInput
    calendar_events?: CalendarEventUpdateManyWithoutUserNestedInput
    gmail_messages?: GmailMessageUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutDiary_entriesInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    memory_chunks?: MemoryChunkUncheckedUpdateManyWithoutUserNestedInput
    summaries?: SummaryUncheckedUpdateManyWithoutUserNestedInput
    calendar_events?: CalendarEventUncheckedUpdateManyWithoutUserNestedInput
    gmail_messages?: GmailMessageUncheckedUpdateManyWithoutUserNestedInput
  }

  export type AttachmentUpsertWithWhereUniqueWithoutDiary_entryInput = {
    where: AttachmentWhereUniqueInput
    update: XOR<AttachmentUpdateWithoutDiary_entryInput, AttachmentUncheckedUpdateWithoutDiary_entryInput>
    create: XOR<AttachmentCreateWithoutDiary_entryInput, AttachmentUncheckedCreateWithoutDiary_entryInput>
  }

  export type AttachmentUpdateWithWhereUniqueWithoutDiary_entryInput = {
    where: AttachmentWhereUniqueInput
    data: XOR<AttachmentUpdateWithoutDiary_entryInput, AttachmentUncheckedUpdateWithoutDiary_entryInput>
  }

  export type AttachmentUpdateManyWithWhereWithoutDiary_entryInput = {
    where: AttachmentScalarWhereInput
    data: XOR<AttachmentUpdateManyMutationInput, AttachmentUncheckedUpdateManyWithoutDiary_entryInput>
  }

  export type AttachmentScalarWhereInput = {
    AND?: AttachmentScalarWhereInput | AttachmentScalarWhereInput[]
    OR?: AttachmentScalarWhereInput[]
    NOT?: AttachmentScalarWhereInput | AttachmentScalarWhereInput[]
    id?: StringFilter<"Attachment"> | string
    diary_entry_id?: StringFilter<"Attachment"> | string
    storage_path?: StringFilter<"Attachment"> | string
    file_type?: StringFilter<"Attachment"> | string
    extracted_text?: StringNullableFilter<"Attachment"> | string | null
    created_at?: DateTimeFilter<"Attachment"> | Date | string
  }

  export type CalendarEventUpsertWithWhereUniqueWithoutDiary_entryInput = {
    where: CalendarEventWhereUniqueInput
    update: XOR<CalendarEventUpdateWithoutDiary_entryInput, CalendarEventUncheckedUpdateWithoutDiary_entryInput>
    create: XOR<CalendarEventCreateWithoutDiary_entryInput, CalendarEventUncheckedCreateWithoutDiary_entryInput>
  }

  export type CalendarEventUpdateWithWhereUniqueWithoutDiary_entryInput = {
    where: CalendarEventWhereUniqueInput
    data: XOR<CalendarEventUpdateWithoutDiary_entryInput, CalendarEventUncheckedUpdateWithoutDiary_entryInput>
  }

  export type CalendarEventUpdateManyWithWhereWithoutDiary_entryInput = {
    where: CalendarEventScalarWhereInput
    data: XOR<CalendarEventUpdateManyMutationInput, CalendarEventUncheckedUpdateManyWithoutDiary_entryInput>
  }

  export type DiaryEntryCreateWithoutAttachmentsInput = {
    id?: string
    entry_date?: Date | string
    raw_text: string
    status?: string
    created_at?: Date | string
    updated_at?: Date | string
    user: UserCreateNestedOneWithoutDiary_entriesInput
    calendar_events?: CalendarEventCreateNestedManyWithoutDiary_entryInput
  }

  export type DiaryEntryUncheckedCreateWithoutAttachmentsInput = {
    id?: string
    user_id: string
    entry_date?: Date | string
    raw_text: string
    status?: string
    created_at?: Date | string
    updated_at?: Date | string
    calendar_events?: CalendarEventUncheckedCreateNestedManyWithoutDiary_entryInput
  }

  export type DiaryEntryCreateOrConnectWithoutAttachmentsInput = {
    where: DiaryEntryWhereUniqueInput
    create: XOR<DiaryEntryCreateWithoutAttachmentsInput, DiaryEntryUncheckedCreateWithoutAttachmentsInput>
  }

  export type DiaryEntryUpsertWithoutAttachmentsInput = {
    update: XOR<DiaryEntryUpdateWithoutAttachmentsInput, DiaryEntryUncheckedUpdateWithoutAttachmentsInput>
    create: XOR<DiaryEntryCreateWithoutAttachmentsInput, DiaryEntryUncheckedCreateWithoutAttachmentsInput>
    where?: DiaryEntryWhereInput
  }

  export type DiaryEntryUpdateToOneWithWhereWithoutAttachmentsInput = {
    where?: DiaryEntryWhereInput
    data: XOR<DiaryEntryUpdateWithoutAttachmentsInput, DiaryEntryUncheckedUpdateWithoutAttachmentsInput>
  }

  export type DiaryEntryUpdateWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutDiary_entriesNestedInput
    calendar_events?: CalendarEventUpdateManyWithoutDiary_entryNestedInput
  }

  export type DiaryEntryUncheckedUpdateWithoutAttachmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    calendar_events?: CalendarEventUncheckedUpdateManyWithoutDiary_entryNestedInput
  }

  export type UserCreateWithoutMemory_chunksInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    diary_entries?: DiaryEntryCreateNestedManyWithoutUserInput
    summaries?: SummaryCreateNestedManyWithoutUserInput
    calendar_events?: CalendarEventCreateNestedManyWithoutUserInput
    gmail_messages?: GmailMessageCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutMemory_chunksInput = {
    id?: string
    supabaseId: string
    email: string
    display_name?: string | null
    google_connected?: boolean
    google_access_token?: string | null
    google_refresh_token?: string | null
    created_at?: Date | string
    updated_at?: Date | string
    diary_entries?: DiaryEntryUncheckedCreateNestedManyWithoutUserInput
    summaries?: SummaryUncheckedCreateNestedManyWithoutUserInput
    calendar_events?: CalendarEventUncheckedCreateNestedManyWithoutUserInput
    gmail_messages?: GmailMessageUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutMemory_chunksInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutMemory_chunksInput, UserUncheckedCreateWithoutMemory_chunksInput>
  }

  export type EntityMentionCreateWithoutChunkInput = {
    id?: string
    entity_type: string
    entity_value: string
    created_at?: Date | string
  }

  export type EntityMentionUncheckedCreateWithoutChunkInput = {
    id?: string
    entity_type: string
    entity_value: string
    created_at?: Date | string
  }

  export type EntityMentionCreateOrConnectWithoutChunkInput = {
    where: EntityMentionWhereUniqueInput
    create: XOR<EntityMentionCreateWithoutChunkInput, EntityMentionUncheckedCreateWithoutChunkInput>
  }

  export type EntityMentionCreateManyChunkInputEnvelope = {
    data: EntityMentionCreateManyChunkInput | EntityMentionCreateManyChunkInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutMemory_chunksInput = {
    update: XOR<UserUpdateWithoutMemory_chunksInput, UserUncheckedUpdateWithoutMemory_chunksInput>
    create: XOR<UserCreateWithoutMemory_chunksInput, UserUncheckedCreateWithoutMemory_chunksInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutMemory_chunksInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutMemory_chunksInput, UserUncheckedUpdateWithoutMemory_chunksInput>
  }

  export type UserUpdateWithoutMemory_chunksInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entries?: DiaryEntryUpdateManyWithoutUserNestedInput
    summaries?: SummaryUpdateManyWithoutUserNestedInput
    calendar_events?: CalendarEventUpdateManyWithoutUserNestedInput
    gmail_messages?: GmailMessageUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutMemory_chunksInput = {
    id?: StringFieldUpdateOperationsInput | string
    supabaseId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    display_name?: NullableStringFieldUpdateOperationsInput | string | null
    google_connected?: BoolFieldUpdateOperationsInput | boolean
    google_access_token?: NullableStringFieldUpdateOperationsInput | string | null
    google_refresh_token?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entries?: DiaryEntryUncheckedUpdateManyWithoutUserNestedInput
    summaries?: SummaryUncheckedUpdateManyWithoutUserNestedInput
    calendar_events?: CalendarEventUncheckedUpdateManyWithoutUserNestedInput
    gmail_messages?: GmailMessageUncheckedUpdateManyWithoutUserNestedInput
  }

  export type EntityMentionUpsertWithWhereUniqueWithoutChunkInput = {
    where: EntityMentionWhereUniqueInput
    update: XOR<EntityMentionUpdateWithoutChunkInput, EntityMentionUncheckedUpdateWithoutChunkInput>
    create: XOR<EntityMentionCreateWithoutChunkInput, EntityMentionUncheckedCreateWithoutChunkInput>
  }

  export type EntityMentionUpdateWithWhereUniqueWithoutChunkInput = {
    where: EntityMentionWhereUniqueInput
    data: XOR<EntityMentionUpdateWithoutChunkInput, EntityMentionUncheckedUpdateWithoutChunkInput>
  }

  export type EntityMentionUpdateManyWithWhereWithoutChunkInput = {
    where: EntityMentionScalarWhereInput
    data: XOR<EntityMentionUpdateManyMutationInput, EntityMentionUncheckedUpdateManyWithoutChunkInput>
  }

  export type EntityMentionScalarWhereInput = {
    AND?: EntityMentionScalarWhereInput | EntityMentionScalarWhereInput[]
    OR?: EntityMentionScalarWhereInput[]
    NOT?: EntityMentionScalarWhereInput | EntityMentionScalarWhereInput[]
    id?: StringFilter<"EntityMention"> | string
    chunk_id?: StringFilter<"EntityMention"> | string
    entity_type?: StringFilter<"EntityMention"> | string
    entity_value?: StringFilter<"EntityMention"> | string
    created_at?: DateTimeFilter<"EntityMention"> | Date | string
  }

  export type DiaryEntryCreateManyUserInput = {
    id?: string
    entry_date?: Date | string
    raw_text: string
    status?: string
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type MemoryChunkCreateManyUserInput = {
    id?: string
    sourceType: string
    sourceId: string
    chunkType?: string
    text: string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SummaryCreateManyUserInput = {
    id?: string
    summary_type: string
    period_start: Date | string
    period_end: Date | string
    content: string
    created_at?: Date | string
  }

  export type CalendarEventCreateManyUserInput = {
    id?: string
    external_id: string
    title: string
    start_time: Date | string
    end_time: Date | string
    diary_entry_id?: string | null
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type GmailMessageCreateManyUserInput = {
    id?: string
    external_id: string
    sender: string
    subject: string
    body: string
    created_at?: Date | string
  }

  export type DiaryEntryUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    attachments?: AttachmentUpdateManyWithoutDiary_entryNestedInput
    calendar_events?: CalendarEventUpdateManyWithoutDiary_entryNestedInput
  }

  export type DiaryEntryUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    attachments?: AttachmentUncheckedUpdateManyWithoutDiary_entryNestedInput
    calendar_events?: CalendarEventUncheckedUpdateManyWithoutDiary_entryNestedInput
  }

  export type DiaryEntryUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    entry_date?: DateTimeFieldUpdateOperationsInput | Date | string
    raw_text?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MemoryChunkUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    chunkType?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    entity_mentions?: EntityMentionUpdateManyWithoutChunkNestedInput
  }

  export type MemoryChunkUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    chunkType?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    entity_mentions?: EntityMentionUncheckedUpdateManyWithoutChunkNestedInput
  }

  export type MemoryChunkUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceType?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    chunkType?: StringFieldUpdateOperationsInput | string
    text?: StringFieldUpdateOperationsInput | string
    metadata?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SummaryUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    summary_type?: StringFieldUpdateOperationsInput | string
    period_start?: DateTimeFieldUpdateOperationsInput | Date | string
    period_end?: DateTimeFieldUpdateOperationsInput | Date | string
    content?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SummaryUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    summary_type?: StringFieldUpdateOperationsInput | string
    period_start?: DateTimeFieldUpdateOperationsInput | Date | string
    period_end?: DateTimeFieldUpdateOperationsInput | Date | string
    content?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SummaryUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    summary_type?: StringFieldUpdateOperationsInput | string
    period_start?: DateTimeFieldUpdateOperationsInput | Date | string
    period_end?: DateTimeFieldUpdateOperationsInput | Date | string
    content?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CalendarEventUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    start_time?: DateTimeFieldUpdateOperationsInput | Date | string
    end_time?: DateTimeFieldUpdateOperationsInput | Date | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entry?: DiaryEntryUpdateOneWithoutCalendar_eventsNestedInput
  }

  export type CalendarEventUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    start_time?: DateTimeFieldUpdateOperationsInput | Date | string
    end_time?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entry_id?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CalendarEventUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    start_time?: DateTimeFieldUpdateOperationsInput | Date | string
    end_time?: DateTimeFieldUpdateOperationsInput | Date | string
    diary_entry_id?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GmailMessageUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    subject?: StringFieldUpdateOperationsInput | string
    body?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GmailMessageUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    subject?: StringFieldUpdateOperationsInput | string
    body?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GmailMessageUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    sender?: StringFieldUpdateOperationsInput | string
    subject?: StringFieldUpdateOperationsInput | string
    body?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AttachmentCreateManyDiary_entryInput = {
    id?: string
    storage_path: string
    file_type: string
    extracted_text?: string | null
    created_at?: Date | string
  }

  export type CalendarEventCreateManyDiary_entryInput = {
    id?: string
    user_id: string
    external_id: string
    title: string
    start_time: Date | string
    end_time: Date | string
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type AttachmentUpdateWithoutDiary_entryInput = {
    id?: StringFieldUpdateOperationsInput | string
    storage_path?: StringFieldUpdateOperationsInput | string
    file_type?: StringFieldUpdateOperationsInput | string
    extracted_text?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AttachmentUncheckedUpdateWithoutDiary_entryInput = {
    id?: StringFieldUpdateOperationsInput | string
    storage_path?: StringFieldUpdateOperationsInput | string
    file_type?: StringFieldUpdateOperationsInput | string
    extracted_text?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AttachmentUncheckedUpdateManyWithoutDiary_entryInput = {
    id?: StringFieldUpdateOperationsInput | string
    storage_path?: StringFieldUpdateOperationsInput | string
    file_type?: StringFieldUpdateOperationsInput | string
    extracted_text?: NullableStringFieldUpdateOperationsInput | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CalendarEventUpdateWithoutDiary_entryInput = {
    id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    start_time?: DateTimeFieldUpdateOperationsInput | Date | string
    end_time?: DateTimeFieldUpdateOperationsInput | Date | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutCalendar_eventsNestedInput
  }

  export type CalendarEventUncheckedUpdateWithoutDiary_entryInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    start_time?: DateTimeFieldUpdateOperationsInput | Date | string
    end_time?: DateTimeFieldUpdateOperationsInput | Date | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CalendarEventUncheckedUpdateManyWithoutDiary_entryInput = {
    id?: StringFieldUpdateOperationsInput | string
    user_id?: StringFieldUpdateOperationsInput | string
    external_id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    start_time?: DateTimeFieldUpdateOperationsInput | Date | string
    end_time?: DateTimeFieldUpdateOperationsInput | Date | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EntityMentionCreateManyChunkInput = {
    id?: string
    entity_type: string
    entity_value: string
    created_at?: Date | string
  }

  export type EntityMentionUpdateWithoutChunkInput = {
    id?: StringFieldUpdateOperationsInput | string
    entity_type?: StringFieldUpdateOperationsInput | string
    entity_value?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EntityMentionUncheckedUpdateWithoutChunkInput = {
    id?: StringFieldUpdateOperationsInput | string
    entity_type?: StringFieldUpdateOperationsInput | string
    entity_value?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EntityMentionUncheckedUpdateManyWithoutChunkInput = {
    id?: StringFieldUpdateOperationsInput | string
    entity_type?: StringFieldUpdateOperationsInput | string
    entity_value?: StringFieldUpdateOperationsInput | string
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}