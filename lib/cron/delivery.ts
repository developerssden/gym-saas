export type DeliveryExecutionResult = {
  stateChanged: boolean;
  sent: boolean;
  failed: boolean;
  skipped: boolean;
  error?: unknown;
};

type ExpirationDeliveryInput = {
  alreadyExpired: boolean;
  hasRecipient: boolean;
  markExpired: () => Promise<void>;
  send: () => Promise<void>;
  markDelivered: () => Promise<void>;
};

export async function executeExpirationDelivery({
  alreadyExpired,
  hasRecipient,
  markExpired,
  send,
  markDelivered,
}: ExpirationDeliveryInput): Promise<DeliveryExecutionResult> {
  let stateChanged = false;

  if (!alreadyExpired) {
    try {
      await markExpired();
      stateChanged = true;
    } catch (error) {
      return {
        stateChanged,
        sent: false,
        failed: true,
        skipped: false,
        error,
      };
    }
  }

  if (!hasRecipient) {
    return {
      stateChanged,
      sent: false,
      failed: false,
      skipped: true,
    };
  }

  try {
    await send();
    await markDelivered();
    return {
      stateChanged,
      sent: true,
      failed: false,
      skipped: false,
    };
  } catch (error) {
    return {
      stateChanged,
      sent: false,
      failed: true,
      skipped: false,
      error,
    };
  }
}

type ReminderDeliveryInput = {
  hasRecipient: boolean;
  send: () => Promise<void>;
  markDelivered: () => Promise<void>;
};

export async function executeReminderDelivery({
  hasRecipient,
  send,
  markDelivered,
}: ReminderDeliveryInput): Promise<DeliveryExecutionResult> {
  if (!hasRecipient) {
    return {
      stateChanged: false,
      sent: false,
      failed: false,
      skipped: true,
    };
  }

  try {
    await send();
    await markDelivered();
    return {
      stateChanged: false,
      sent: true,
      failed: false,
      skipped: false,
    };
  } catch (error) {
    return {
      stateChanged: false,
      sent: false,
      failed: true,
      skipped: false,
      error,
    };
  }
}
