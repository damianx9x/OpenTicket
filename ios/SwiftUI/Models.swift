import Foundation

// MARK: - Setup Response from Desktop
struct SetupResponse: Codable {
    let success: Bool
    let message: String
    let configPath: String?
    let adminUserId: String?
    let migrationsApplied: Int?
}

// MARK: - QR Code Data
struct QRCodeData: Codable {
    let apiBase: String
    let token: String
}

// MARK: - Ticket Models
struct Ticket: Identifiable, Codable {
    let id: String
    let title: String
    let description: String
    let status: String
    let priority: String
    let createdAt: String
    let updatedAt: String
    let assignee: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case status
        case priority
        case createdAt
        case updatedAt
        case assignee
    }
}

// MARK: - API Responses
struct ApiResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: String?
}

// MARK: - Connection Status
enum ConnectionStatus {
    case disconnected
    case scanning
    case connecting(String) // with API URL
    case connected(String)   // with API URL
    case error(String)
}
