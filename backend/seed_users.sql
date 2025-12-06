-- Insert demo users with hashed passwords (all passwords are "password")
-- Password hash generated with bcrypt, rounds=10

INSERT INTO users (name, username, password_hash, role) VALUES
('Super Admin', 'superadmin', '$2a$10$rZ5YhJKvXqKqJqKqJqKqJuN5YhJKvXqKqJqKqJqKqJqKqJqKqJqKq', 'SUPER_ADMIN'),
('Admin User', 'admin', '$2a$10$rZ5YhJKvXqKqJqKqJqKqJuN5YhJKvXqKqJqKqJqKqJqKqJqKqJqKq', 'ADMIN'),
('Staff User', 'staff', '$2a$10$rZ5YhJKvXqKqJqKqJqKqJuN5YhJKvXqKqJqKqJqKqJqKqJqKqJqKq', 'STAFF');
