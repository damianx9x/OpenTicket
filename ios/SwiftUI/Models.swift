import Foundation

// MARK: - QR Code Data
struct QRCodeData: Codable {
    let apiBase: String
    let token: String?
}

// MARK: - Auth
struct AuthUser: Codable {
    let id: String
    let email: String
    let name: String?
    let role: String
    let phone: String?
}

struct AuthLoginPayload: Codable {
    let token: String
    let expiresAt: String
    let user: AuthUser
}

// MARK: - API Envelope
struct ApiEnvelope<T: Codable>: Codable {
    let data: T?
    let meta: [String: String]?
    let success: Bool?
    let error: String?
    let message: String?
}

// MARK: - Ticket
struct UserRef: Codable {
    let id: String
    let name: String?
    let email: String?
}

struct Ticket: Identifiable, Codable {
    let id: String
    let number: Int?
    let title: String
    let description: String
    let status: String
    let priority: String
    let createdAt: String
    let updatedAt: String
    let owner: UserRef?
    let assignedAgent: UserRef?

    var assigneeDisplayName: String {
        assignedAgent?.name ?? "Nieprzypisany"
    }

    var ownerDisplayName: String {
        owner?.name ?? owner?.email ?? "Klient"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case number
        case title
        case description
        case status
        case priority
        case createdAt
        case updatedAt
        case owner
        case assignedAgent
    }
}

struct TicketComment: Codable, Identifiable {
    let id: String
    let body: String
    let isInternal: Bool?
    let createdAt: String
    let author: UserRef?
}

struct TicketAttachment: Codable, Identifiable {
    let id: String
    let filename: String
    let mimeType: String
    let createdAt: String
    let byteSize: Int?
}

struct TicketStatusEvent: Codable, Identifiable {
    let id: String
    let fromStatus: String?
    let toStatus: String
    let changedAt: String
    let user: UserRef?
}

struct TicketDetail: Codable, Identifiable {
    let id: String
    let number: Int?
    let title: String
    let description: String
    let status: String
    let priority: String
    let createdAt: String
    let updatedAt: String
    let owner: UserRef?
    let assignedAgent: UserRef?
    let comments: [TicketComment]?
    let attachments: [TicketAttachment]?
    let statusHistory: [TicketStatusEvent]?

    var assigneeDisplayName: String {
        assignedAgent?.name ?? "Nieprzypisany"
    }

    var ownerDisplayName: String {
        owner?.name ?? owner?.email ?? "Klient"
    }
}

// MARK: - Connection Status
enum ConnectionStatus {
    case disconnected
    case scanning
    case connecting(String) // with API URL
    case connected(String)   // with API URL
    case error(String)
}
