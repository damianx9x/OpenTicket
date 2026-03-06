import Foundation
import Combine

@MainActor
final class NetworkManager: ObservableObject {
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var tickets: [Ticket] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isAuthenticated = false
    @Published var sessionUser: AuthUser?
    @Published var apiBase = ""

    private let apiBaseKey = "apiBase"

    init() {
        let storedBase = UserDefaults.standard.string(forKey: apiBaseKey) ?? ""
        apiBase = storedBase
        if !storedBase.isEmpty {
            connectionStatus = .connected(storedBase)
        }
        if KeychainManager.shared.getToken() != nil {
            isAuthenticated = true
        }
    }

    private var authToken: String? {
        KeychainManager.shared.getToken()
    }

    var sessionToken: String? {
        authToken
    }

    // MARK: - Pairing / Connection
    func processQRData(_ qrString: String) async {
        connectionStatus = .scanning
        errorMessage = nil

        guard let data = qrString.data(using: .utf8) else {
            connectionStatus = .error("Niepoprawny kod QR (pusty payload).")
            return
        }

        do {
            let qrData = try JSONDecoder().decode(QRCodeData.self, from: data)
            try await connect(apiBaseUrl: qrData.apiBase, token: qrData.token)
        } catch {
            connectionStatus = .error("Nie udało się odczytać QR: \(error.localizedDescription)")
        }
    }

    func connect(apiBaseUrl: String) async throws {
        try await connect(apiBaseUrl: apiBaseUrl, token: nil)
    }

    func connect(apiBaseUrl: String, token: String?) async throws {
        let normalized = normalizeApiBase(apiBaseUrl)
        connectionStatus = .connecting(normalized)
        errorMessage = nil

        if let token, !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            KeychainManager.shared.saveToken(token.trimmingCharacters(in: .whitespacesAndNewlines))
            isAuthenticated = true
        }

        try await testConnection(to: normalized)
        apiBase = normalized
        UserDefaults.standard.set(normalized, forKey: apiBaseKey)
        connectionStatus = .connected(normalized)

        if isAuthenticated {
            do {
                try await fetchCurrentUser()
                try await fetchTickets()
            } catch {
                KeychainManager.shared.deleteToken()
                isAuthenticated = false
                sessionUser = nil
            }
        }
    }

    // MARK: - Auth
    func login(email: String, password: String) async throws {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalizedEmail.isEmpty, !password.isEmpty else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Wpisz e-mail i hasło."])
        }
        guard !apiBase.isEmpty else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Najpierw połącz z serwerem."])
        }

        var request = URLRequest(url: try buildUrl(path: "/api/v1/auth/login"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "email": normalizedEmail,
            "password": password,
        ])

        let data = try await performDataRequest(request)
        let envelope = try JSONDecoder().decode(ApiEnvelope<AuthLoginPayload>.self, from: data)
        guard let payload = envelope.data else {
            throw NSError(domain: "OpenTicket.iOS", code: 401, userInfo: [
                NSLocalizedDescriptionKey: envelope.message ?? envelope.error ?? "Logowanie nieudane.",
            ])
        }

        KeychainManager.shared.saveToken(payload.token)
        sessionUser = payload.user
        isAuthenticated = true
        errorMessage = nil

        try await fetchTickets()
    }

    func logout() {
        KeychainManager.shared.deleteToken()
        isAuthenticated = false
        sessionUser = nil
    }

    // MARK: - Tickets
    func fetchTickets(
        page: Int = 1,
        limit: Int = 50,
        search: String? = nil,
        status: String? = nil,
        onlyMine: Bool = false,
        minAgeDays: Int? = nil,
        sort: String = "createdAt_desc"
    ) async throws {
        guard !apiBase.isEmpty else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Brak adresu API."])
        }
        guard let token = authToken else {
            throw NSError(domain: "OpenTicket.iOS", code: 401, userInfo: [NSLocalizedDescriptionKey: "Najpierw zaloguj się w aplikacji iOS."])
        }

        isLoading = true
        defer { isLoading = false }

        var items: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(max(1, min(limit, 100)))),
            URLQueryItem(name: "page", value: String(max(1, page))),
            URLQueryItem(name: "sort", value: sort),
        ]

        if let search, !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            items.append(URLQueryItem(name: "search", value: search))
        }
        if let status, !status.isEmpty, status != "ALL" {
            items.append(URLQueryItem(name: "status", value: status))
        }
        if onlyMine {
            items.append(URLQueryItem(name: "onlyMine", value: "true"))
        }
        if let minAgeDays, minAgeDays > 0 {
            items.append(URLQueryItem(name: "minAgeDays", value: String(minAgeDays)))
        }

        var request = URLRequest(url: try buildUrl(path: "/api/v1/tickets", queryItems: items))
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let data = try await performDataRequest(request)
            let envelope = try JSONDecoder().decode(ApiEnvelope<[Ticket]>.self, from: data)
            tickets = envelope.data ?? []
            errorMessage = nil
        } catch {
            errorMessage = "Nie udało się pobrać zgłoszeń: \(error.localizedDescription)"
            throw error
        }
    }

    func fetchTicketDetail(id: String) async throws -> TicketDetail {
        guard let token = authToken else {
            throw NSError(domain: "OpenTicket.iOS", code: 401, userInfo: [NSLocalizedDescriptionKey: "Brak tokenu logowania."])
        }
        var request = URLRequest(url: try buildUrl(path: "/api/v1/tickets/\(id)"))
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let data = try await performDataRequest(request)
        return try decodeEnvelopeOrPlain(TicketDetail.self, from: data)
    }

    func createTicket(
        title: String,
        description: String,
        priority: String,
        customerName: String?,
        customerEmail: String?
    ) async throws {
        guard let token = authToken else {
            throw NSError(domain: "OpenTicket.iOS", code: 401, userInfo: [NSLocalizedDescriptionKey: "Brak tokenu logowania."])
        }
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Podaj tytuł zgłoszenia."])
        }
        guard description.trimmingCharacters(in: .whitespacesAndNewlines).count >= 10 else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Opis musi mieć minimum 10 znaków."])
        }

        var payload: [String: Any] = [
            "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
            "description": description.trimmingCharacters(in: .whitespacesAndNewlines),
            "priority": priority,
            "channel": "APP",
        ]
        if let customerName, !customerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            payload["customerName"] = customerName.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if let customerEmail, !customerEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            payload["customerEmail"] = customerEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        var request = URLRequest(url: try buildUrl(path: "/api/v1/tickets"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        _ = try await performDataRequest(request)
        try await fetchTickets()
    }

    func updateTicketStatus(ticketId: String, status: String) async throws {
        guard let token = authToken else {
            throw NSError(domain: "OpenTicket.iOS", code: 401, userInfo: [NSLocalizedDescriptionKey: "Brak tokenu logowania."])
        }
        var request = URLRequest(url: try buildUrl(path: "/api/v1/tickets/\(ticketId)"))
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["status": status])

        _ = try await performDataRequest(request)
        try await fetchTickets()
    }

    // MARK: - Session Reset
    func disconnect() {
        UserDefaults.standard.removeObject(forKey: apiBaseKey)
        KeychainManager.shared.deleteToken()
        connectionStatus = .disconnected
        tickets = []
        sessionUser = nil
        isAuthenticated = false
        errorMessage = nil
        apiBase = ""
    }

    // MARK: - Internal helpers
    private func normalizeApiBase(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        }
        return "http://\(trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "/")))"
    }

    private func buildUrl(path: String, queryItems: [URLQueryItem] = []) throws -> URL {
        guard let baseUrl = URL(string: apiBase) else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Niepoprawny adres API."])
        }

        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        guard var components = URLComponents(url: baseUrl.appendingPathComponent(normalizedPath), resolvingAgainstBaseURL: false) else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Niepoprawny URL endpointu."])
        }

        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        guard let url = components.url else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Nie udało się zbudować URL endpointu."])
        }
        return url
    }

    private func testConnection(to apiBaseUrl: String) async throws {
        guard let url = URL(string: "\(apiBaseUrl)/api/v1/setup/status") else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Niepoprawny adres API."])
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        _ = try await performDataRequest(request)
    }

    private func fetchCurrentUser() async throws {
        guard let token = authToken else {
            throw NSError(domain: "OpenTicket.iOS", code: 401, userInfo: [NSLocalizedDescriptionKey: "Brak tokenu."])
        }
        var request = URLRequest(url: try buildUrl(path: "/api/v1/auth/me"))
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let data = try await performDataRequest(request)
        let user = try decodeEnvelopeOrPlain(AuthUser.self, from: data)
        sessionUser = user
        isAuthenticated = true
    }

    private func decodeEnvelopeOrPlain<T: Codable>(_ type: T.Type, from data: Data) throws -> T {
        let decoder = JSONDecoder()
        if let envelope = try? decoder.decode(ApiEnvelope<T>.self, from: data), let payload = envelope.data {
            return payload
        }
        return try decoder.decode(T.self, from: data)
    }

    private func performDataRequest(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "OpenTicket.iOS", code: -1, userInfo: [NSLocalizedDescriptionKey: "Brak odpowiedzi HTTP."])
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)"
            throw NSError(domain: "OpenTicket.iOS", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
        }
        return data
    }
}
