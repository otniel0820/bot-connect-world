export interface BotControlSettings {
  bot_enabled: boolean;
  demos_enabled: boolean;
  renewals_enabled: boolean;
  new_activations_enabled: boolean;
}

export abstract class BotControlRepositoryPort {
  abstract getSettings(): Promise<BotControlSettings>;
  /** Inicia un change stream. Llama onChange con los nuevos valores en cada cambio.
   *  Retorna una función para cerrar el stream. */
  abstract watchChanges(
    onChange: (settings: BotControlSettings) => void,
    onError: (err: Error) => void,
  ): () => Promise<void>;
}
