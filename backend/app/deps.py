"""Reusable FastAPI dependencies for auth and role-based access control."""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import ROLE_ACCOUNTS, ROLE_PARENT, Student, User
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error
    try:
        payload = decode_access_token(token)
        email = payload.get("sub")
        if not email:
            raise credentials_error
    except jwt.PyJWTError:
        raise credentials_error

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_error
    return user


def require_accounts(user: User = Depends(get_current_user)) -> User:
    if user.role != ROLE_ACCOUNTS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accounts executive role required",
        )
    return user


def require_parent(user: User = Depends(get_current_user)) -> User:
    if user.role != ROLE_PARENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Parent role required",
        )
    return user


def authorize_student_access(db: Session, user: User, student: Student) -> None:
    """Parents may only access their own linked student; accounts staff see all."""
    if user.role == ROLE_ACCOUNTS:
        return
    if user.role == ROLE_PARENT and student.parent_user_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not authorized to access this student's records",
    )
