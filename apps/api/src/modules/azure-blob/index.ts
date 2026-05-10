import { Module } from '@medusajs/framework/utils'
import { IFileService } from '@medusajs/types'
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob'

// ---------------------------------------------------------------------------
// Azure Blob Storage Module for Medusa v2
// Replaces local filesystem storage for product images, media, and exports.
// Supports public blob access for CDN delivery via Azure Front Door.
// ---------------------------------------------------------------------------

type AzureBlobOptions = {
  connectionString: string
  containerName: string
}

class AzureBlobService implements IFileService {
  protected readonly client_: BlobServiceClient
  protected readonly containerName_: string

  constructor({}, options: AzureBlobOptions) {
    this.client_ = BlobServiceClient.fromConnectionString(options.connectionString)
    this.containerName_ = options.containerName
  }

  async upload(file: Express.Multer.File): Promise<any> {
    const containerClient = this.client_.getContainerClient(this.containerName_)
    await containerClient.createIfNotExists({ access: 'blob' })

    const blobName = `${Date.now()}-${file.originalname}`
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.upload(file.buffer, file.buffer.length, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
      },
    })

    return {
      url: blockBlobClient.url,
      key: blobName,
    }
  }

  async uploadProtected(file: Express.Multer.File): Promise<any> {
    const containerClient = this.client_.getContainerClient(this.containerName_)
    await containerClient.createIfNotExists({ access: 'blob' })

    const blobName = `protected/${Date.now()}-${file.originalname}`
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.upload(file.buffer, file.buffer.length, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
      },
    })

    return {
      url: blockBlobClient.url,
      key: blobName,
    }
  }

  async delete(fileData: any): Promise<void> {
    const containerClient = this.client_.getContainerClient(this.containerName_)
    const blockBlobClient = containerClient.getBlockBlobClient(fileData.key)
    await blockBlobClient.deleteIfExists()
  }

  async getPresignedDownloadUrl(fileData: any): Promise<string> {
    return fileData.url
  }

  async getDownloadStream(fileData: any): Promise<NodeJS.ReadableStream> {
    const containerClient = this.client_.getContainerClient(this.containerName_)
    const blockBlobClient = containerClient.getBlockBlobClient(fileData.key)
    const response = await blockBlobClient.download(0)
    return response.readableStreamBody as NodeJS.ReadableStream
  }
}

export default Module('azure-blob', {
  service: AzureBlobService,
})
