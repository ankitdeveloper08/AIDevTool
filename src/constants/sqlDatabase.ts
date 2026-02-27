export const SQL_SETUP_SCRIPT = `
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  department_id INTEGER,
  salary DECIMAL(10, 2)
);

INSERT INTO employees (id, first_name, last_name, department_id, salary) VALUES 
  (1, 'John', 'Doe', 1, 75000.00),
  (2, 'Jane', 'Smith', 2, 82000.00),
  (3, 'Michael', 'Johnson', 1, 78000.00),
  (4, 'Emily', 'Williams', 3, 65000.00),
  (5, 'David', 'Brown', 2, 90000.00);

CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  department_name VARCHAR(50) NOT NULL,
  location VARCHAR(50)
);

INSERT INTO departments (id, department_name, location) VALUES 
  (1, 'Engineering', 'New York'),
  (2, 'Marketing', 'San Francisco'),
  (3, 'HR', 'Chicago');

CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  project_name VARCHAR(100) NOT NULL,
  budget DECIMAL(12, 2),
  department_id INTEGER
);

INSERT INTO projects (id, project_name, budget, department_id) VALUES 
  (1, 'Website Redesign', 50000.00, 2),
  (2, 'Mobile App Development', 120000.00, 1),
  (3, 'Employee Wellness Program', 15000.00, 3),
  (4, 'Cloud Migration', 200000.00, 1);
`;

export const SQL_TABLES = [
  {
    name: 'employees',
    columns: [
      { name: 'id', type: 'INTEGER' },
      { name: 'first_name', type: 'VARCHAR(50)' },
      { name: 'last_name', type: 'VARCHAR(50)' },
      { name: 'department_id', type: 'INTEGER' },
      { name: 'salary', type: 'DECIMAL(10, 2)' }
    ],
    data: [
      [1, 'John', 'Doe', 1, '75000.00'],
      [2, 'Jane', 'Smith', 2, '82000.00'],
      [3, 'Michael', 'Johnson', 1, '78000.00'],
      [4, 'Emily', 'Williams', 3, '65000.00'],
      [5, 'David', 'Brown', 2, '90000.00']
    ]
  },
  {
    name: 'departments',
    columns: [
      { name: 'id', type: 'INTEGER' },
      { name: 'department_name', type: 'VARCHAR(50)' },
      { name: 'location', type: 'VARCHAR(50)' }
    ],
    data: [
      [1, 'Engineering', 'New York'],
      [2, 'Marketing', 'San Francisco'],
      [3, 'HR', 'Chicago']
    ]
  },
  {
    name: 'projects',
    columns: [
      { name: 'id', type: 'INTEGER' },
      { name: 'project_name', type: 'VARCHAR(100)' },
      { name: 'budget', type: 'DECIMAL(12, 2)' },
      { name: 'department_id', type: 'INTEGER' }
    ],
    data: [
      [1, 'Website Redesign', '50000.00', 2],
      [2, 'Mobile App Development', '120000.00', 1],
      [3, 'Employee Wellness Program', '15000.00', 3],
      [4, 'Cloud Migration', '200000.00', 1]
    ]
  }
];
