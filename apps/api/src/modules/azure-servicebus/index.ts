import { Module } from '@medusajs/framework/utils'
import { IEventBusService } from '@medusajs/types'
import { ServiceBusClient, ServiceBusMessage } from '@azure/service-bus'

// ---------------------------------------------------------------------------
// Azure Service Bus Module for Medusa v2
// Event bus adapter that publishes domain events to Service Bus queues.
// Enables async processing of order events, inventory updates,
// email notifications, and payout processing at scale.
// ---------------------------------------------------------------------------

type AzureServiceBusOptions = {
  connectionString: string
}

class AzureServiceBusService implements IEventBusService {
  protected readonly client_: ServiceBusClient
  protected readonly logger_: any

  constructor({ logger }: { logger: any }, options: AzureServiceBusOptions) {
    this.client_ = new ServiceBusClient(options.connectionString)
    this.logger_ = logger
  }

  async emit<T>(data: T | T[], options: Record<string, any> = {}): Promise<void> {
    const events = Array.isArray(data) ? data : [data]

    for (const event of events) {
      const eventName = (event as any).eventName || 'unknown-event'
      const queueName = this.mapEventToQueue_(eventName)

      try {
        const sender = this.client_.createSender(queueName)
        const message: ServiceBusMessage = {
          body: event,
          contentType: 'application/json',
          applicationProperties: {
            eventName,
            timestamp: new Date().toISOString(),
          },
        }

        await sender.sendMessages(message)
        await sender.close()

        this.logger_.info(`Event ${eventName} sent to queue ${queueName}`)
      } catch (error) {
        this.logger_.error(`Failed to send event ${eventName} to queue ${queueName}:`, error)
        throw error
      }
    }
  }

  async subscribe(eventName: string, subscriber: any, context: any): Promise<void> {
    const queueName = this.mapEventToQueue_(eventName)

    try {
      const receiver = this.client_.createReceiver(queueName)

      receiver.subscribe({
        processMessage: async (message) => {
          try {
            await subscriber(message.body)
            await receiver.completeMessage(message)
          } catch (error) {
            await receiver.abandonMessage(message)
            this.logger_.error(`Failed to process message from ${queueName}:`, error)
          }
        },
        processError: async (args) => {
          this.logger_.error(`Service Bus error on ${queueName}:`, args.error)
        },
      })

      this.logger_.info(`Subscribed to queue ${queueName} for event ${eventName}`)
    } catch (error) {
      this.logger_.error(`Failed to subscribe to queue ${queueName}:`, error)
      throw error
    }
  }

  async unsubscribe(eventName: string, subscriber: any, context: any): Promise<void> {
    // Service Bus receiver cleanup handled by SDK
  }

  private mapEventToQueue_(eventName: string): string {
    const queueMap: Record<string, string> = {
      'order.placed': 'order-created',
      'order.updated': 'order-created',
      'order.completed': 'order-created',
      'inventory.updated': 'inventory-update',
      'inventory.reserved': 'inventory-update',
      'customer.created': 'email-notification',
      'customer.password_reset': 'email-notification',
      'order.payment_captured': 'payout-processing',
      'payout.created': 'payout-processing',
    }

    return queueMap[eventName] || 'email-notification'
  }
}

export default Module('azure-servicebus', {
  service: AzureServiceBusService,
})
