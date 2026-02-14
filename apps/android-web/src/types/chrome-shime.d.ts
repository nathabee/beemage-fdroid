/* demo-only type shim: lets tsc typecheck shared code that references `chrome`
   without adding @types/chrome or requiring Chrome at runtime. */

declare const chrome: {
  runtime: {
    onMessage: {
      addListener(handler: (...args: any[]) => any): void;
      removeListener(handler: (...args: any[]) => any): void;
    };
    sendMessage(message: any): Promise<any>;
  };
  storage: {
    local: {
      get(keys: any): Promise<any>;
      set(items: any): Promise<void>;
      remove(keys: any): Promise<void>;
    };
    onChanged: {
      addListener(handler: (...args: any[]) => any): void;
      removeListener(handler: (...args: any[]) => any): void;
    };
  };
};
