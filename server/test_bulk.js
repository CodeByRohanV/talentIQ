import jwt from 'jsonwebtoken';

async function run() {
    const secret = '4b3153e32c221d2b8d5d6657805e52682653f103c46d04367f2b2399a50fe6724f4baac8392841a737b9beafe548c6ed5a74d27844540a084644312e0f55885b';
    const token = jwt.sign({ 
        tenant: 'rohan', 
        employeeId: 'EMP001',
        email: 'rohan.v@xevyte.com'
    }, secret);
    
    const res = await fetch('http://localhost:5000/api/questions/bulk', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            questions: [
                {
                    domain: 'behavioral',
                    domainName: 'Behavioral',
                    domain_id: null,
                    questionText: 'Test question bulk upload?',
                    options: ['1', '2', '3', '4'],
                    correctAnswer: 1,
                    difficulty: 'easy'
                },
                {
                    domain: 'behavioral',
                    domainName: 'Behavioral',
                    domain_id: null,
                    questionText: 'Test question bulk upload 2?',
                    options: ['1', '2', '3', '4'],
                    correctAnswer: 1,
                    difficulty: 'easy'
                }
            ]
        })
    });
    
    const data = await res.json();
    console.log(res.status, data);
}
run();
