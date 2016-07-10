interface User {
    id: string;
    token: string;
    pocket_username: string;
}

interface Article {
    user: string;
    html: string;
}
