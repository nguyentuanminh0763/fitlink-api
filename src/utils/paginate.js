// utils/paginate.js

export const paginate = async (model, query = {}, options = {}) => {
  const page = parseInt(options.page) || 1
  const limit = parseInt(options.limit) || 10
  const sort = options.sort || { createdAt: -1 }
  const populate = options.populate || null

  const skip = (page - 1) * limit

  const findQuery = model.find(query).skip(skip).limit(limit).sort(sort)
  if (populate) findQuery.populate(populate)

  const [data, total] = await Promise.all([
    findQuery.exec(),
    model.countDocuments(query)
  ])

  return {
    data,
    pagination: {
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      pageSize: limit
    }
  }
}
