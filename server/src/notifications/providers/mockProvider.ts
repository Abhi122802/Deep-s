import {
  INotificationProvider,
  NotificationPayload,
  NotificationSendResult,
  NotificationChannel,
} from '../types.js';

export interface MockSentRecord {
  id: string;
  timestamp: Date;
  payload: NotificationPayload;
  result: NotificationSendResult;
}

export class DevMockNotificationProvider implements INotificationProvider {
  readonly name = 'mock';
  readonly supportedChannels: readonly NotificationChannel[] = ['email', 'whatsapp', 'sms'] as const;

  private sentRecords: MockSentRecord[] = [];
  private failureSimulationRemaining = 0;
  private simulateRetryable = true;
  private simulatedErrorMessage = 'Simulated upstream gateway timeout';

  /**
   * Simulates sending notification without communicating with real external networks
   */
  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    if (payload.signal?.aborted) {
      return {
        success: false,
        error: 'Operation aborted by client timeout signal',
        retryable: true,
      };
    }

    // Check if failure simulation is active
    if (this.failureSimulationRemaining > 0) {
      this.failureSimulationRemaining--;
      const failureResult: NotificationSendResult = {
        success: false,
        error: this.simulatedErrorMessage,
        retryable: this.simulateRetryable,
      };

      this.sentRecords.push({
        id: `mock_fail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date(),
        payload: { ...payload },
        result: failureResult,
      });

      return failureResult;
    }

    const providerMessageId = `mock_msg_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const successResult: NotificationSendResult = {
      success: true,
      providerMessageId,
    };

    this.sentRecords.push({
      id: providerMessageId,
      timestamp: new Date(),
      payload: { ...payload },
      result: successResult,
    });

    return successResult;
  }

  /**
   * Returns list of recorded sent notifications for test inspection and auditing
   */
  getSentRecords(): readonly MockSentRecord[] {
    return [...this.sentRecords];
  }

  /**
   * Returns the most recent record
   */
  getLastRecord(): MockSentRecord | undefined {
    return this.sentRecords[this.sentRecords.length - 1];
  }

  /**
   * Clears internal log records and resets simulation states
   */
  clear(): void {
    this.sentRecords = [];
    this.failureSimulationRemaining = 0;
    this.simulateRetryable = true;
  }

  /**
   * Configures failure simulation for bounded retry testing
   * @param failCount Number of subsequent requests that will fail
   * @param retryable Whether the simulated failure is flagged as retryable
   * @param errorMessage Custom error message
   */
  setFailureSimulation(failCount: number, retryable = true, errorMessage = 'Simulated upstream gateway timeout'): void {
    this.failureSimulationRemaining = failCount;
    this.simulateRetryable = retryable;
    this.simulatedErrorMessage = errorMessage;
  }
}

export const defaultMockProvider = new DevMockNotificationProvider();
