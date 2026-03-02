import Foundation

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
                // Token from QR may be temporary. Keep connected state but require login.
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
    func fetchTickets() async throws {
        guard !apiBase.isEmpty else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Brak adresu API."])
        }
        guard let token = authToken else {
            throw NSError(domain: "OpenTicket.iOS", code: 401, userInfo: [NSLocalizedDescriptionKey: "Najpierw zaloguj się w aplikacji iOS."])
        }

        isLoading = true
        defer { isLoading = false }

        var request = URLRequest(url: try buildUrl(path: "/api/v1/tickets?limit=50&page=1&sort=createdAt_desc"))
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

    private func buildUrl(path: String) throws -> URL {
        guard let url = URL(string: "\(apiBase)\(path)") else {
            throw NSError(domain: "OpenTicket.iOS", code: 400, userInfo: [NSLocalizedDescriptionKey: "Niepoprawny adres API."])
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
        let user = try JSONDecoder().decode(AuthUser.self, from: data)
        sessionUser = user
        isAuthenticated = true
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

