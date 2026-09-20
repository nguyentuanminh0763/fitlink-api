import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'

const registerByPhone = async (req, res, next) => {
  const correctCondition = Joi.object({
    phone: Joi.string()
      .trim()
      .strict()
      .pattern(/^0[0-9]{9}$/)
      .required()
      .messages({
        'string.pattern.base': 'Số điện thoại không đúng định dạng',
        'any.required': 'Số điện thoại là bắt buộc'
      }),

    password: Joi.string()
      .trim()
      .strict()
      .min(6)
      .required()
      .messages({
        'string.min': 'Mật khẩu phải ít nhất 6 ký tự',
        'any.required': 'Mật khẩu là bắt buộc'
      }),

    email: Joi.string()
      .trim()
      .strict()
      .email()
      .required()
      .messages({
        'string.email': 'Email không đúng định dạng',
        'any.required': 'Email là bắt buộc'
      }),

    name: Joi.string()
      .trim()
      .min(2)
      .max(30)
      .required()
      .messages({
        'string.min': 'Tên phải có ít nhất 2 ký tự',
        'string.max': 'Tên không được vượt quá 30 ký tự',
        'any.required': 'Tên là bắt buộc'
      })
  })

  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false });
    next()
  } catch (error) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      errors: error.details.map(err => err.message) // trả về danh sách lỗi
    })
  }
}

const login = async (req, res, next) => {
  const correctCondition = Joi.object({
    phone: Joi.string()
      .trim()
      .custom((value, helpers) => {
        const isPhone = /^0[0-9]{9}$/.test(value);
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        if (!isPhone && !isEmail) {
          return helpers.message('Vui lòng nhập số điện thoại hợp lệ (10 số) hoặc email');
        }
        return value;
      })
      .required()
      .messages({
        'any.required': 'Số điện thoại hoặc email là bắt buộc'
      }),
    password: Joi.string()
      .trim()
      .min(6)
      .required()
      .messages({
        'string.min': 'Mật khẩu phải ít nhất 6 ký tự',
        'any.required': 'Mật khẩu là bắt buộc'
      })
  }).unknown(true)
  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    console.log('VALIDATION')
    next()
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      errors: new Error(error).message
    })
  }
}

const updateProfile = async (req, res, next) => {
  const correctCondition = Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(30)
      .optional()
      .messages({
        'string.min': 'Tên phải có ít nhất 2 ký tự',
        'string.max': 'Tên không được vượt quá 30 ký tự'
      }),
    email: Joi.string()
      .email()
      .optional()
      .messages({
        'string.email': 'Email không đúng định dạng'
      }),
    gender: Joi.string()
      .valid('male', 'female', 'other')
      .optional()
      .messages({
        'any.only': 'Giới tính phải là male, female hoặc other'
      }),
    address: Joi.string()
      .trim()
      .optional(),
    dob: Joi.date()
      .optional()
      .messages({
        'date.base': 'Ngày sinh không đúng định dạng'
      }),
    avatar: Joi.string()
      .uri()
      .optional()
      .messages({
        'string.uri': 'Avatar phải là URL hợp lệ'
      })
  })

  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      errors: error.details.map(err => err.message)
    })
  }
}

const changePassword = async (req, res, next) => {
  const correctCondition = Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Mật khẩu hiện tại là bắt buộc'
      }),
    newPassword: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': 'Mật khẩu mới phải ít nhất 6 ký tự',
        'any.required': 'Mật khẩu mới là bắt buộc'
      })
  })

  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      errors: error.details.map(err => err.message)
    })
  }
}

const forgotPassword = async (req, res, next) => {
  const correctCondition = Joi.object({
    phone: Joi.string()
      .trim()
      .strict()
      .pattern(/^0[0-9]{9}$/)
      .required()
      .messages({
        'string.pattern.base': 'Số điện thoại không đúng định dạng',
        'any.required': 'Số điện thoại là bắt buộc'
      })
  })

  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      errors: error.details.map(err => err.message)
    })
  }
}

const resetPassword = async (req, res, next) => {
  const schema = Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Thiếu token đặt lại mật khẩu'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Mật khẩu mới phải ít nhất 6 ký tự',
      'any.required': 'Mật khẩu mới là bắt buộc'
    }),
    confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({
      'any.only': 'Xác nhận mật khẩu không khớp',
      'any.required': 'Xác nhận mật khẩu là bắt buộc'
    })
  })

  const data = {
    token: req.params.token,
    ...req.body
  }

  try {
    await schema.validateAsync(data, { abortEarly: false })
    next()
  } catch (error) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      errors: error.details.map((err) => err.message)
    })
  }
}


export const authValidation = {
  registerByPhone,
  login,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
}
