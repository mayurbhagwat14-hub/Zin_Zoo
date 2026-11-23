export const buildPaginationOptions = (query, defaultLimit = 20, maxLimit = 50000) => {
    const page = Math.max(parseInt(query?.page, 10) || 1, 1);
    const parsedLimit = parseInt(query?.limit, 10);
    const limit = Math.min(Math.max(parsedLimit || defaultLimit, 1), maxLimit);
    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

export const buildPaginatedResult = ({ docs, total, page, limit }) => {
    const totalPages = Math.ceil(total / limit) || 1;

    return {
        data: docs,
        meta: {
            total,
            page,
            limit,
            totalPages
        }
    };
};

