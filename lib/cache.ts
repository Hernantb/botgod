import type { Conversation, Message } from './database'

/**
 * Simple cache implementation for the app
 * Permite almacenar temporalmente datos en memoria para
 * reducir llamadas a la API.
 */

// Definición de valores de expiración para diferentes tipos de datos
const EXPIRATION_TIMES = {
  // Expiración por defecto: 60 segundos
  default: 60 * 1000,
  
  // Datos específicos
  conversations: 60 * 60 * 1000, // 1 hora para conversaciones (aumentado)
  messages: 24 * 60 * 60 * 1000, // 24 horas para mensajes (un día completo)
  business: 5 * 60 * 1000, // 5 minutos para datos de negocio
};

// Tipo para los datos en caché
type CacheItem<T> = {
  data: T;
  expiry: number;
  type: string;
};

// Mapa para almacenar los datos en caché
const cacheStore = new Map<string, Map<string, CacheItem<any>>>();

/**
 * Utilidad para crear claves de caché consistentes
 */
function createCacheKey(type: string, key: string): string {
  return `${type}:${key}`;
}

export class Cache {
  private cache: Map<string, any>
  private expirationTimes: Map<string, number>
  private messageQueue: Map<string, Set<any>>
  private batchTimeout: NodeJS.Timeout | null
  private updateLocks: Map<string, boolean>
  private updateTimers: Map<string, NodeJS.Timeout>
  private readonly DEFAULT_EXPIRATION = 24 * 60 * 60 * 1000 // 24 horas (aumentado de 1 hora a 24 horas)
  private readonly BATCH_INTERVAL = 2000 // 2 segundos
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 100 // ms

  constructor() {
    this.cache = new Map()
    this.expirationTimes = new Map()
    this.messageQueue = new Map()
    this.updateLocks = new Map()
    this.updateTimers = new Map()
    this.batchTimeout = null
  }

  private getKey(type: string, id: string): string {
    return `${type}:${id}`
  }

  private isExpired(key: string): boolean {
    const expiration = this.expirationTimes.get(key)
    return expiration ? Date.now() > expiration : true
  }

  private isLocked(key: string): boolean {
    return this.updateLocks.get(key) || false
  }

  private async acquireLock(key: string, retries = 0): Promise<boolean> {
    if (this.isLocked(key)) {
      if (retries < this.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, retries)))
        return this.acquireLock(key, retries + 1)
      }
      return false
    }
    this.updateLocks.set(key, true)
    return true
  }

  private releaseLock(key: string): void {
    this.updateLocks.delete(key)
  }

  private debounce(key: string, fn: () => void, delay: number = 100): void {
    if (this.updateTimers.has(key)) {
      clearTimeout(this.updateTimers.get(key)!)
    }
    const timer = setTimeout(() => {
      fn()
      this.updateTimers.delete(key)
    }, delay)
    this.updateTimers.set(key, timer)
  }

  private scheduleBatch() {
    if (this.batchTimeout === null) {
      this.batchTimeout = setTimeout(() => {
        this.processBatch()
      }, this.BATCH_INTERVAL)
    }
  }

  private async processBatch() {
    this.batchTimeout = null
    for (const [key, messages] of this.messageQueue.entries()) {
      if (messages.size > 0) {
        await this.processQueuedMessages(key, messages)
      }
    }
  }

  private async processQueuedMessages(key: string, messages: Set<any>): Promise<void> {
    if (await this.acquireLock(key)) {
      try {
        const currentData = this.cache.get(key) || []
        const newData = Array.from(messages)
        const updatedData = this.mergeMessages(currentData, newData)
        this.cache.set(key, updatedData)
        this.expirationTimes.set(key, Date.now() + this.DEFAULT_EXPIRATION)
        messages.clear()
      } finally {
        this.releaseLock(key)
      }
    }
  }

  private mergeMessages(current: any[], incoming: any[]): any[] {
    const messageMap = new Map(current.map(msg => [msg.id, msg]))
    incoming.forEach(msg => messageMap.set(msg.id, msg))
    return Array.from(messageMap.values()).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }

  async get(type: string, id: string): Promise<any> {
    const key = this.getKey(type, id)
    if (!this.cache.has(key) || this.isExpired(key)) {
      return null
    }
    return this.cache.get(key)
  }

  async set(type: string, id: string, data: any, expiration: number = this.DEFAULT_EXPIRATION): Promise<void> {
    const key = this.getKey(type, id)
    this.debounce(key, async () => {
      if (await this.acquireLock(key)) {
        try {
          const currentData = this.cache.get(key)
          if (Array.isArray(data) && Array.isArray(currentData)) {
            this.cache.set(key, this.mergeMessages(currentData, data))
          } else {
            this.cache.set(key, data)
          }
          this.expirationTimes.set(key, Date.now() + expiration)
        } finally {
          this.releaseLock(key)
        }
      }
    })
  }

  async queueMessage(type: string, id: string, message: any): Promise<void> {
    const key = this.getKey(type, id)
    if (!this.messageQueue.has(key)) {
      this.messageQueue.set(key, new Set())
    }
    this.messageQueue.get(key)!.add(message)
    this.scheduleBatch()
  }

  async invalidate(type: string, id: string): Promise<void> {
    const key = this.getKey(type, id)
    this.debounce(key, async () => {
      if (await this.acquireLock(key)) {
        try {
          if (!this.messageQueue.has(key) || this.messageQueue.get(key)!.size === 0) {
            this.cache.delete(key)
            this.expirationTimes.delete(key)
          }
        } finally {
          this.releaseLock(key)
        }
      }
    })
  }

  clear(): void {
    this.cache.clear()
    this.expirationTimes.clear()
    this.messageQueue.clear()
    this.updateLocks.clear()
    this.updateTimers.forEach(timer => clearTimeout(timer))
    this.updateTimers.clear()
    if (this.batchTimeout !== null) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }
  }

  async updateMessages(type: string, id: string, messages: any[]): Promise<void> {
    const key = this.getKey(type, id)
    this.debounce(key, async () => {
      if (await this.acquireLock(key)) {
        try {
          const currentMessages = await this.get(type, id) || []
          const updatedMessages = this.mergeMessages(currentMessages, messages)
          await this.set(type, id, updatedMessages)
        } finally {
          this.releaseLock(key)
        }
      }
    })
  }

  async handleOptimisticUpdate(type: string, id: string, tempMessage: any, finalMessage: any): Promise<void> {
    const key = this.getKey(type, id)
    if (await this.acquireLock(key)) {
      try {
        const currentMessages = await this.get(type, id) || []
        const updatedMessages = currentMessages.map((m: any) => 
          m.id === tempMessage.id ? finalMessage : m
        )
        await this.set(type, id, updatedMessages)
      } finally {
        this.releaseLock(key)
      }
    }
  }
}

export const cache = new Cache() 