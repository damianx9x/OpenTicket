import Foundation

class NetworkManager: ObservableObject {
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var tickets: [Ticket] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var apiBase: String {
        UserDefaults.standard.string(forKey: "apiBase") ?? ""
    }
    
    private var authToken: String? {
        KeychainManager.shared.getToken()
    }
    
    // MARK: - QR Code Processing
    func processQRData(_ qrString: String) async {
        DispatchQueue.main.async {
            self.connectionStatus = .scanning
        }
        
        do {
            let data = qrString.data(using: .utf8)!
            let qrData = try JSONDecoder().decode(QRCodeData.self, from: data)
            
            // Save API URL and token
            UserDefaults.standard.set(qrData.apiBase, forKey: "apiBase")
            KeychainManager.shared.saveToken(qrData.token)
            
            // Test connection
            DispatchQueue.main.async {
                self.connectionStatus = .connecting(qrData.apiBase)
            }
            
            try await testConnection()
        } catch {
            DispatchQueue.main.async {
                self.connectionStatus = .error("Invalid QR code: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - API Calls
    private func testConnection() async throws {
        let url = URL(string: "\(apiBase)/api/v1/setup/status")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw NSError(domain: "Connection failed", code: -1)
        }
        
        DispatchQueue.main.async {
            self.connectionStatus = .connected(self.apiBase)
        }
        
        // Fetch initial data
        try await fetchTickets()
    }
    
    func fetchTickets() async throws {
        DispatchQueue.main.async {
            self.isLoading = true
        }
        
        guard let url = URL(string: "\(apiBase)/api/v1/tickets") else {
            throw NSError(domain: "Invalid URL", code: -1)
        }
        
        var request = URLRequest(url: url)
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                throw NSError(domain: "API error", code: -1)
            }
            
            let decoded = try JSONDecoder().decode(ApiResponse<[Ticket]>.self, from: data)
            
            DispatchQueue.main.async {
                self.tickets = decoded.data ?? []
                self.isLoading = false
            }
        } catch {
            DispatchQueue.main.async {
                self.errorMessage = "Failed to fetch tickets: \(error.localizedDescription)"
                self.isLoading = false
            }
        }
    }
    
    // MARK: - Disconnection
    func disconnect() {
        UserDefaults.standard.removeObject(forKey: "apiBase")
        KeychainManager.shared.deleteToken()
        
        DispatchQueue.main.async {
            self.connectionStatus = .disconnected
            self.tickets = []
            self.errorMessage = nil
        }
    }
}
