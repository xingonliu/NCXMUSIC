// ========= 类型 =========

/** 把基准语言包中的字符串字面量递归放宽为字符串，同时保留完整键结构。 */
export type LocaleMessagesFor<T> = T extends string
  ? string
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: LocaleMessagesFor<T[K]> }
    : T extends object
      ? { readonly [K in keyof T]: LocaleMessagesFor<T[K]> }
      : T
